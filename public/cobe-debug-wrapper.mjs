import createGlobeOrig from '/cobe.index.esm.js';

function instrumentGL(gl){
  if(!gl || gl.__cobe_instrumented) return gl;
  const names = ['drawArrays','drawElements','texImage2D','bufferData','useProgram','bindTexture'];
  for(const name of names){
    const orig = gl[name];
    if(!orig) continue;
    gl[name] = function(...args){
      try{ (window.__cobeLogs = window.__cobeLogs || []).push({fn: name, time: Date.now(), argsLength: args.length}); }catch(e){}
      return orig.apply(this, args);
    }
  }
  gl.__cobe_instrumented = true;
  return gl;
}

export default function createGlobe(canvas, cfg){
  // wrap canvas.getContext to instrument returned contexts
  const origGet = canvas.getContext.bind(canvas);
  canvas.getContext = function(type, opts){
    const gl = origGet(type, opts);
    try{ instrumentGL(gl); }catch(e){}
    return gl;
  };
  // call original createGlobe
  const res = createGlobeOrig(canvas, cfg);
  // expose for debugging
  try{ window.__inAppCobe = Object.assign(window.__inAppCobe || {}, {instance: res, cfg: cfg, createdAt: Date.now(), canvas}); }catch(e){}
  return res;
}
