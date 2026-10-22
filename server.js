import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:150*1024*1024,files:3}});
// Require an access password on cloud deployments to prevent unauthorized API usage.
app.get('/health',(req,res)=>res.status(200).send('ok'));
app.use((req,res,next)=>{
 const configured=process.env.APP_ACCESS_PASSWORD;
 if(!configured){
   if(process.env.NODE_ENV==='production')return res.status(503).send('APP_ACCESS_PASSWORD is required in production.');
   return next();
 }
 const header=req.headers.authorization||'';
 if(header.startsWith('Basic ')){
  try{
   const pair=Buffer.from(header.slice(6),'base64').toString('utf8');
   const password=pair.substring(pair.indexOf(':')+1);
   const a=Buffer.from(password),b=Buffer.from(configured);
   if(a.length===b.length && (awaitCompare(a,b)))return next();
  }catch{}
 }
 res.set('WWW-Authenticate','Basic realm="fix_retouch", charset="UTF-8"');
 res.status(401).send('Authentication required');
});
function awaitCompare(a,b){return requireSafeEqual(a,b)}
function requireSafeEqual(a,b){
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
app.use(express.static('public'));
const errResponse=(res,error,status=500)=>res.status(status).json({error:String(error?.message||error)});
app.post('/api/edit',upload.fields([{name:'image',maxCount:1},{name:'mask',maxCount:1}]),async(req,res)=>{
 try{
  if(!process.env.OPENAI_API_KEY)return errResponse(res,'OPENAI_API_KEY が設定されていません。',503);
  const image=req.files?.image?.[0]?.buffer,mask=req.files?.mask?.[0]?.buffer;
  if(!image||!mask)return errResponse(res,'画像とマスクが必要です。',400);
  const meta=await sharp(image).metadata();
  const w=meta.width,h=meta.height;
  if(!w||!h||w>7680||h>4320)return errResponse(res,'解像度が未対応です。',400);
  const maskRaw=await sharp(mask).ensureAlpha().resize(w,h).raw().toBuffer();
  let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(maskRaw[(y*w+x)*4+3]>100){minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);}
  if(maxX<0)return errResponse(res,'赤い範囲がありません。',400);
  const margin=Math.max(64,Math.round(Math.max(maxX-minX+1,maxY-minY+1)*.3));
  const l=Math.max(0,minX-margin),t=Math.max(0,minY-margin),r=Math.min(w,maxX+margin+1),b=Math.min(h,maxY+margin+1),cw=r-l,ch=b-t;
  const sourceCrop=await sharp(image).extract({left:l,top:t,width:cw,height:ch}).png().toBuffer();
  const alpha=Buffer.alloc(cw*ch*4,255);
  for(let yy=0;yy<ch;yy++)for(let xx=0;xx<cw;xx++)alpha[(yy*cw+xx)*4+3]=255-maskRaw[((yy+t)*w+(xx+l))*4+3];
  const maskCrop=await sharp(alpha,{raw:{width:cw,height:ch,channels:4}}).png().toBuffer();
  const instruction=String(req.body.prompt||'').trim();
  const remove=req.body.mode==='remove';
  if(!remove&&!instruction)return errResponse(res,'変更内容を入力してください。',400);
  const prompt='Edit only the transparent masked region of this crop from a larger video frame. '+(remove?'Remove the selected element and seamlessly restore the background.':instruction)+' Keep original lighting, exposure, colors, shadows, perspective, textures and photorealism. Do not change any other area. Never draw red marks.';
  const form=new FormData();
  form.append('model',process.env.OPENAI_IMAGE_MODEL||'gpt-image-2');
  form.append('image',new Blob([sourceCrop],{type:'image/png'}),'crop.png');
  form.append('mask',new Blob([maskCrop],{type:'image/png'}),'mask.png');
  form.append('prompt',prompt);form.append('output_format','png');
  const response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:form});
  const result=await response.json();
  if(!response.ok)throw Error(result.error?.message||'OpenAI画像編集に失敗しました。');
  if(!result.data?.[0]?.b64_json)throw Error('APIから画像が返りませんでした。');
  const generated=await sharp(Buffer.from(result.data[0].b64_json,'base64')).resize(cw,ch,{fit:'fill'}).removeAlpha().ensureAlpha().raw().toBuffer();
  for(let yy=0;yy<ch;yy++)for(let xx=0;xx<cw;xx++)generated[(yy*cw+xx)*4+3]=maskRaw[((yy+t)*w+(xx+l))*4+3];
  const patch=await sharp(generated,{raw:{width:cw,height:ch,channels:4}}).png().toBuffer();
  const full=await sharp(image).ensureAlpha().composite([{input:patch,left:l,top:t}]).png().toBuffer();
  res.json({png:'data:image/png;base64,'+full.toString('base64'),width:w,height:h,crop:{x:l,y:t,width:cw,height:ch}});
 }catch(e){console.error(e);errResponse(res,e);}
});
app.post('/api/track-mask',upload.fields([{name:'video',maxCount:1},{name:'mask',maxCount:1}]),async(req,res)=>{
 let folder;
 try{
  const video=req.files?.video?.[0],mask=req.files?.mask?.[0];
  if(!video||!mask)return errResponse(res,'動画と白黒マスクが必要です。',400);
  folder=await mkdtemp(path.join(os.tmpdir(),'fix-retouch-'));
  const vf=path.join(folder,'input.mp4'),mf=path.join(folder,'mask.png'),out=path.join(folder,'mask.mp4');
  await writeFile(vf,video.buffer);await writeFile(mf,mask.buffer);
  const secs=Number(req.body.time||0);
  if(!Number.isFinite(secs)||secs<0)return errResponse(res,'時間の値が不正です。',400);
  const result=await new Promise((resolve,reject)=>{
   const p=spawn(process.env.PYTHON_BIN||'python3',['track_mask.py',vf,mf,String(secs),out],{timeout:600000});
   let stdout='',stderr='';
   p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);
   p.on('error',reject);p.on('close',code=>{if(code!==0)reject(Error(stdout||stderr||'追跡エラー'));else{try{resolve(JSON.parse(stdout.trim().split('\n').at(-1)))}catch{reject(Error('追跡結果を読み取れません。'))}}});
  });
  const bytes=await readFile(out);
  res.json({video:'data:video/mp4;base64,'+bytes.toString('base64'),...result});
 }catch(e){console.error(e);errResponse(res,e)}finally{if(folder)await rm(folder,{recursive:true,force:true})}
});
app.use((error,req,res,next)=>errResponse(res,error,400));
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log('fix_retouch: http://localhost:'+port));
