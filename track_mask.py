"""Track a keyframe black/white mask across a constant-frame-rate video."""
import sys, os, json, shutil, tempfile, subprocess
import cv2
import numpy as np

def die(message):
    print(json.dumps({'error':str(message)},ensure_ascii=False)); sys.exit(1)

def main():
    if len(sys.argv)!=5: die('Incorrect tracking arguments')
    video_path, mask_path, selected, out_path=sys.argv[1:]
    cap=cv2.VideoCapture(video_path)
    if not cap.isOpened(): die('動画を読み込めません。')
    fps=cap.get(cv2.CAP_PROP_FPS)
    n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH));h=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if fps<=0 or n<=0 or w<=0 or h<=0: die('フレーム数またはFPSを取得できません。')
    if n>3600: die('最大3600フレームです。')
    key=max(0,min(n-1,round(float(selected)*fps)))
    base=cv2.imread(mask_path,cv2.IMREAD_GRAYSCALE)
    if base is None: die('マスクを読み込めません。')
    if base.shape!=(h,w): base=cv2.resize(base,(w,h),interpolation=cv2.INTER_NEAREST)
    edit=np.where(base<128,0,255).astype(np.uint8)
    if np.all(edit==255): die('黒い修正範囲を指定してください。')
    scale=min(1.0,960/max(w,h));sw=max(16,round(w*scale));sh=max(16,round(h*scale))
    roi=cv2.resize(255-edit,(sw,sh),interpolation=cv2.INTER_NEAREST)
    ys,xs=np.where(roi>128)
    left,right=max(0,int(xs.min())-25),min(sw,int(xs.max())+26)
    top,bottom=max(0,int(ys.min())-25),min(sh,int(ys.max())+26)
    region=np.zeros((sh,sw),np.uint8);region[top:bottom,left:right]=255
    def frame_at(idx):
        cap.set(cv2.CAP_PROP_POS_FRAMES,idx)
        ok,im=cap.read()
        if not ok: raise RuntimeError(f'フレーム {idx} が取得できません。')
        return cv2.cvtColor(cv2.resize(im,(sw,sh)),cv2.COLOR_BGR2GRAY)
    def propagate(prev,current,roi,T):
        p=cv2.goodFeaturesToTrack(prev,maxCorners=350,qualityLevel=.01,minDistance=5,mask=roi)
        if p is None or len(p)<7: return T,False
        q,status,_=cv2.calcOpticalFlowPyrLK(prev,current,p,None,winSize=(27,27),maxLevel=3)
        if q is None or status is None: return T,False
        good=status.flatten()==1
        if np.count_nonzero(good)<6: return T,False
        a,inlier=cv2.estimateAffinePartial2D(p[good],q[good],method=cv2.RANSAC,ransacReprojThreshold=3)
        if a is None or (inlier is not None and inlier.mean()<.48): return T,False
        if np.hypot(a[0,2],a[1,2])>max(sw,sh)*.18: return T,False
        M=np.eye(3);M[:2,:]=a
        return M@T,True
    folder=tempfile.mkdtemp(prefix='fix_retouch_')
    warnings=0
    try:
        def render(idx,T):
            mat=T[:2].copy()
            mat[:,2]/=scale
            result=cv2.warpAffine(edit,mat,(w,h),flags=cv2.INTER_NEAREST,borderMode=cv2.BORDER_CONSTANT,borderValue=255)
            cv2.imwrite(os.path.join(folder,f'{idx:08}.png'),result,[cv2.IMWRITE_PNG_COMPRESSION,3])
        render(key,np.eye(3))
        for direction in (-1,1):
            prev=frame_at(key);T=np.eye(3);idx=key+direction
            while 0<=idx<n:
                current=frame_at(idx)
                moving_roi=cv2.warpAffine(region,T[:2],(sw,sh),flags=cv2.INTER_NEAREST)
                newT,ok=propagate(prev,current,moving_roi,T)
                if ok:T=newT
                else:warnings+=1
                render(idx,T)
                prev=current;idx+=direction
        cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate',str(fps),'-i',os.path.join(folder,'%08d.png'),'-c:v','libx264','-preset','veryfast','-crf','12','-pix_fmt','yuv420p','-movflags','+faststart',out_path]
        subprocess.run(cmd,check=True,timeout=360,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        print(json.dumps({'frames':n,'fps':round(fps,3),'width':w,'height':h,'keyframe':key,'trackingWarnings':warnings,'note':'Geometric tracking; manually inspect all frames.'},ensure_ascii=False))
    finally:
        cap.release();shutil.rmtree(folder,ignore_errors=True)
if __name__=='__main__':
    try:main()
    except Exception as exc:die(exc)
