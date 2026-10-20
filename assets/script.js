// ---------- Lightweight GLSL compile utilities ----------
function compileProgram(gl, vertexSource, fragmentSource) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader) || "Shader compilation failed";
      gl.deleteShader(shader);
      throw new Error(error);
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program) || "Program linking failed";
    gl.deleteProgram(program);
    throw new Error(error);
  }
  return program;
}

const fullscreenVertex = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main(){ v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }
  `;

// ---------- Global cursor-driven smoke shader ----------
// Page interaction setup.
function initInfernoSmoke() {
  const canvas = $("#inferno-smoke");
  if (!canvas) return null;
  let gl;
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });
  } catch (_) {
    return null;
  }
  if (!gl) {
    canvas.style.display = "none";
    return null;
  }
  const fragment = `
      precision mediump float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      uniform float u_time;
      uniform float u_pulse;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      float fbm(vec2 p){ float v=0.0; float a=.5; mat2 m=mat2(1.6,-1.2,1.2,1.6); for(int i=0;i<5;i++){v+=noise(p)*a;p=m*p+vec2(7.2,3.8);a*=.5;}return v; }
      void main(){
        vec2 uv=v_uv; vec2 aspect=vec2(u_resolution.x/max(u_resolution.y,1.0),1.0); vec2 p=(uv-.5)*aspect;
        vec2 mouse=(u_mouse-.5)*aspect;
        float dist=length(p-mouse); float pull=exp(-dist*4.8)*(0.18+u_pulse*.55);
        p += normalize(p-mouse+vec2(.001))*pull*.10;
        float t=u_time*.12;
        vec2 q=vec2(fbm(p*2.7+vec2(0.,-t)),fbm(p*2.7+vec2(5.2,t*.7)));
        vec2 r=vec2(fbm(p*3.3+q*2.0+vec2(1.7,t*.8)),fbm(p*3.1+q*1.8-vec2(8.3,t)));
        float smoke=fbm(p*3.4+r*2.2+vec2(0.,-t*1.8));
        float flame=fbm(p*5.4+r*3.0+vec2(0.,-t*2.4));
        float plume=smoothstep(.49,.89,smoke)*(1.0-smoothstep(.12,.75,abs(p.x+q.x*.17)));
        float wisps=pow(max(0.0,1.0-abs(fract(flame*3.2+t*.25)-.5)*2.0),7.0)*plume;
        float aura=exp(-dist*2.3)*(.24+u_pulse*.6);
        vec3 coal=vec3(.012,.008,.007);
        vec3 red=vec3(.30,.07,.06); vec3 ember=vec3(1.0,.40,.32); vec3 gold=vec3(1.0,.68,.62); vec3 acid=vec3(.84,1.0,.38);
        vec3 color=coal;
        color=mix(color,red,plume*.45);
        color=mix(color,ember,clamp(plume*.42+wisps*.5+aura*.3,0.0,1.0));
        color=mix(color,gold,clamp(wisps*.30+aura*.23,0.0,.62));
        color=mix(color,acid,clamp(exp(-dist*13.0)*(.22+u_pulse*.5),0.0,.45));
        float alpha=clamp(plume*.30+wisps*.12+aura*.28,0.0,.48);
        float vignette=smoothstep(1.1,.12,length((uv-.5)*vec2(.8,1.0)));
        alpha*=vignette;
        gl_FragColor=vec4(color,alpha);
      }
    `;
  let program;
  try {
    program = compileProgram(gl, fullscreenVertex, fragment);
  } catch (error) {
    console.warn("Smoke shader unavailable; using CSS atmosphere.", error);
    canvas.style.display = "none";
    return null;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "a_position");
  const uniforms = {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    mouse: gl.getUniformLocation(program, "u_mouse"),
    time: gl.getUniformLocation(program, "u_time"),
    pulse: gl.getUniformLocation(program, "u_pulse"),
  };
  let width = 1,
    height = 1,
    lastFrame = 0,
    start = performance.now(),
    visible = true,
    destroyed = false;
  const scale = reducedMotion ? 0.26 : lowPower ? 0.43 : 0.6;
  function resize() {
    width = Math.max(1, Math.floor(window.innerWidth * scale));
    height = Math.max(1, Math.floor(window.innerHeight * scale));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(document.documentElement);
  resize();
  function render(now) {
    if (destroyed) return;
    requestAnimationFrame(render);
    if (
      !visible ||
      document.hidden ||
      now - lastFrame < (reducedMotion ? 500 : 34)
    )
      return;
    lastFrame = now;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniforms.resolution, width, height);
    gl.uniform2f(uniforms.mouse, state.pointerX, 1 - state.pointerY);
    gl.uniform1f(uniforms.time, reducedMotion ? 0 : (now - start) / 1000);
    gl.uniform1f(uniforms.pulse, state.pulse);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  requestAnimationFrame(render);
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
  });
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting && !document.hidden;
  });
  observer.observe(document.body);
  return {
    resize,
    destroy() {
      destroyed = true;
      resizeObserver.disconnect();
      observer.disconnect();
    },
  };
}

// ---------- Second procedural shader lab ----------
function initFieldShader() {
  const canvas = $("#field-canvas");
  const mount = $("#field-viewport");
  if (!canvas || !mount) return null;
  let gl;
  try {
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
  } catch (_) {
    return null;
  }
  if (!gl) {
    $("#field-status").textContent = "CSS FALLBACK";
    mount.classList.add("field-no-webgl");
    return null;
  }
  const fragment = `
      precision mediump float; varying vec2 v_uv; uniform vec2 u_resolution; uniform vec2 u_mouse; uniform float u_time; uniform float u_pulse;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<6;i++){v+=a*n(p);p=mat2(1.7,-1.2,1.2,1.7)*p+vec2(2.3,5.7);a*=.51;}return v;}
      void main(){
       vec2 uv=v_uv;vec2 aspect=vec2(u_resolution.x/u_resolution.y,1.);vec2 p=(uv-.5)*aspect*2.;vec2 m=(u_mouse-.5)*aspect*2.;
       float d=length(p-m);float influence=exp(-d*2.5);p+=normalize(p-m+vec2(.0001))*influence*(.11+u_pulse*.27);
       float t=u_time*.18;vec2 warp=vec2(fbm(p*2.+vec2(t,-t*.5)),fbm(p*2.2+vec2(4.7,t)));
       float field=fbm(p*4.0+warp*3.2+vec2(0.,-t*1.7));float ridges=abs(sin((field*3.5+p.y*.7+t*.25)*6.283));
       float contour=smoothstep(.91,.985,ridges)*smoothstep(.25,.8,field);float molten=smoothstep(.48,.91,field);float core=exp(-d*3.2)*(.4+u_pulse*.7);
       vec3 c0=vec3(.035,.04,.03),c1=vec3(.24,.05,.045),c2=vec3(1.,.40,.32),c3=vec3(.94,.92,.82),c4=vec3(.84,1.0,.38);
       vec3 col=mix(c0,c1,molten*.65);col=mix(col,c2,molten*.55+contour*.8);col=mix(col,c3,contour*.65+core*.45);col=mix(col,c4,exp(-d*16.)*(.15+u_pulse*.8));
       float glow=exp(-d*1.5)*(.15+u_pulse*.4);col+=vec3(.35,.12,.09)*glow;
       float vignette=1.-smoothstep(.4,1.25,length(p));col*=vignette;gl_FragColor=vec4(col,1.);
      }
    `;
  let program;
  try {
    program = compileProgram(gl, fullscreenVertex, fragment);
  } catch (error) {
    console.warn("Field shader failed:", error);
    $("#field-status").textContent = "CSS FALLBACK";
    mount.classList.add("field-no-webgl");
    return null;
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "a_position");
  const u = {
    resolution: gl.getUniformLocation(program, "u_resolution"),
    mouse: gl.getUniformLocation(program, "u_mouse"),
    time: gl.getUniformLocation(program, "u_time"),
    pulse: gl.getUniformLocation(program, "u_pulse"),
  };
  let width = 1,
    height = 1,
    last = 0,
    start = performance.now(),
    visible = false,
    disposed = false,
    pulse = 0,
    pulseTarget = 0;
  const maxDpr = reducedMotion ? 0.35 : lowPower ? 0.6 : 0.85;
  function resize() {
    const rect = mount.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    width = Math.max(1, Math.floor(rect.width * dpr));
    height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  const io = new IntersectionObserver((entries) => {
    visible = Boolean(entries[0]?.isIntersecting) && !document.hidden;
  });
  io.observe(mount);
  function frame(now) {
    if (disposed) return;
    requestAnimationFrame(frame);
    if (!visible || document.hidden || now - last < (reducedMotion ? 600 : 34))
      return;
    last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    pulse += (pulseTarget - pulse) * 0.07;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(u.resolution, width, height);
    const rect = mount.getBoundingClientRect();
    const mx = Math.max(
      0,
      Math.min(1, (pointer.clientX - rect.left) / rect.width),
    );
    const my = Math.max(
      0,
      Math.min(1, (pointer.clientY - rect.top) / rect.height),
    );
    gl.uniform2f(u.mouse, mx, 1 - my);
    gl.uniform1f(u.time, reducedMotion ? 0 : (now - start) / 1000);
    gl.uniform1f(u.pulse, pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  const pointer = {
    clientX: window.innerWidth * 0.5,
    clientY: window.innerHeight * 0.5,
  };
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.clientX = e.clientX;
      pointer.clientY = e.clientY;
      const rect = mount.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        $("#field-x").textContent = (
          ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 -
          1
        ).toFixed(2);
        $("#field-y").textContent = (
          1 -
          ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2
        ).toFixed(2);
      }
    },
    { passive: true },
  );
  requestAnimationFrame(frame);
  $("#field-status").textContent = "ACTIVE";
  return {
    pulse() {
      pulseTarget = 1;
      window.setTimeout(() => (pulseTarget = 0), 900);
    },
    resize,
    destroy() {
      disposed = true;
      ro.disconnect();
      io.disconnect();
    },
  };
}
