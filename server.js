// Frame AI demo backend. Node.js 18+; API keys stay on the server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type':type, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store'});
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
function readJson(req, limit=20000) {
  return new Promise((resolve,reject)=>{
    let raw='';
    req.on('data', chunk=>{raw+=chunk; if(raw.length>limit){reject(new Error('حجم الطلب كبير جداً'));req.destroy();}});
    req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'));}catch{reject(new Error('بيانات JSON غير صالحة'));}});
    req.on('error',reject);
  });
}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(req.method==='POST' && url.pathname==='/api/agent/plan'){
    if(!process.env.OPENAI_API_KEY){return send(res,503,{error:'الخادم غير مُعدّ بعد: أضف OPENAI_API_KEY كمتغير بيئة ثم أعد تشغيله.'});}
    try{
      const body=await readJson(req);
      const description=String(body.description||'').trim();
      if(description.length<10 || description.length>5000) return send(res,400,{error:'الوصف مطلوب، ويجب أن يكون بين 10 و5000 حرف.'});
      const details={'نوع الفيديو':String(body.type||'غير محدد'),'المدة':`${body.duration} ثانية تقريباً`,'النسبة':String(body.ratio||'16:9'),'الموسيقى':String(body.music||'عصرية')};
      const prompt=`أنت مساعد إعداد ومونتاج فيديو. اكتب خطة تنفيذ عملية باللغة العربية، لا تدّع أنك أنشأت الفيديو. اقترح 4 إلى 8 مشاهد بحسب المدة، مع توقيت تقريبي لكل مشهد، وصف بصري، نص الشاشة، وتعليق صوتي مختصر عند الحاجة. اختم بتوصيات مونتاج وموسيقى. حافظ على ملاءمة المحتوى وحقوق الاستخدام.\n\nمواصفات المشروع: ${JSON.stringify(details)}\nوصف العميل: ${description}`;
      const apiRes=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',input:prompt,max_output_tokens:1200})});
      const data=await apiRes.json();
      if(!apiRes.ok){console.error('AI API error:',apiRes.status,data);return send(res,502,{error:'تعذر على مزود الذكاء الاصطناعي إعداد الخطة. تحقق من المفتاح والرصيد وإعدادات المشروع.'});}
      const plan=(data.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n').trim();
      if(!plan) return send(res,502,{error:'لم يرجع النموذج خطة نصية. أعد المحاولة.'});
      return send(res,200,{plan});
    }catch(err){return send(res,400,{error:err.message||'حدث خطأ أثناء معالجة الطلب.'});}
  }
  if(req.method==='GET' && (url.pathname==='/'||url.pathname==='/index.html')){
    try{return send(res,200,fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),'text/html; charset=utf-8');}
    catch{return send(res,500,'تعذر تحميل الصفحة','text/plain; charset=utf-8');}
  }
  return send(res,404,{error:'غير موجود'});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Frame AI demo ready on port ${PORT}`));
