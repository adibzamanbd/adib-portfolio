/* ADIB ZAMAN — CREATIVE PORTFOLIO / vanilla + WebGL */
(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const lowPower =
    window.matchMedia("(max-width: 760px)").matches ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const state = {
    pointerX: 0.5,
    pointerY: 0.5,
    pulse: 0,
    fieldPulse: 0,
    activeFilter: "All work",
    lastFocus: null,
  };

  const projects = [
    {
      id: 1,
      title: "Photographer Portfolio",
      type: "Portfolio",
      label: "Visual storytelling",
      note: "A photography-focused portfolio experiment built around dark editorial styling and image-led composition.",
      href: "https://adibzamanbd.github.io/photographer-portfolio/",
    },
    {
      id: 2,
      title: "Traversy",
      type: "Website",
      label: "Web experience",
      note: "A published website experiment. Process notes and technical decisions are still being documented.",
      href: "https://adibzamanbd.github.io/traversy/",
    },
    {
      id: 3,
      title: "Dorik AI",
      type: "Landing page",
      label: "Product landing page",
      note: "A landing-page study exploring hierarchy, messaging, and a product-oriented visual structure.",
      href: "https://adibzamanbd.github.io/dorik-ai/",
    },
    {
      id: 4,
      title: "Laundry Website",
      type: "Website",
      label: "Service website",
      note: "A service-business website concept focused on presenting information clearly and making the next action easy to find.",
      href: "https://adibzamanbd.github.io/laundry-website/",
    },
    {
      id: 5,
      title: "Sakola Project",
      type: "Website",
      label: "Web experience",
      note: "A published web project. Detailed goals, implementation notes, and lessons learned are still being documented.",
      href: "https://adibzamanbd.github.io/sakola-project/",
    },
    {
      id: 6,
      title: "Copper Rock",
      type: "Website",
      label: "Editorial design",
      note: "An editorial website experiment with an emphasis on whitespace, imagery, and restrained presentation.",
      href: "https://adibzamanbd.github.io/copper-rock/",
    },
    {
      id: 7,
      title: "Alex Portfolio",
      type: "Portfolio",
      label: "Personal website",
      note: "A portfolio design experiment. More detailed design reasoning will be added as the work is reviewed.",
      href: "https://adibzamanbd.github.io/alex-protofilo/",
    },
    {
      id: 8,
      title: "SaaS Landing Page",
      type: "Landing page",
      label: "SaaS concept",
      note: "A product landing-page study exploring structure, feature communication, and conversion-oriented flow.",
      href: "https://adibzamanbd.github.io/saas-landing-page/",
    },
    {
      id: 9,
      title: "G3 Architects",
      type: "Website",
      label: "Architecture website",
      note: "An architecture website project centered on presenting built work through a clean, image-led layout.",
      href: "https://adibzamanbd.github.io/g3-architects/",
    },
  ];

  // ---------- Lightweight GLSL compile utilities ----------
  function compileProgram(gl, vertexSource, fragmentSource) {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error =
          gl.getShaderInfoLog(shader) || "Shader compilation failed";
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
      if (
        !visible ||
        document.hidden ||
        now - last < (reducedMotion ? 600 : 34)
      )
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

  // ---------- Three.js hero sculpture ----------
  function initHeroScene() {
    const mount = $("#hero-scene");
    if (!mount || !window.THREE) {
      if (mount) mount.classList.add("scene-fallback-active");
      return null;
    }
    const THREE = window.THREE;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !lowPower,
        powerPreference: "low-power",
        stencil: false,
        depth: true,
      });
    } catch (error) {
      mount.classList.add("scene-fallback-active");
      console.warn(
        "Three.js could not initialize; SVG fallback remains visible.",
        error,
      );
      return null;
    }
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, lowPower ? 0.85 : 1.25),
    );
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x11120f, 0);
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping)
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.insertBefore(renderer.domElement, mount.firstChild);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    camera.position.set(0, 0, 5.8);
    const root = new THREE.Group();
    scene.add(root);
    const coreGroup = new THREE.Group();
    root.add(coreGroup);
    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uPulse: { value: 0 },
    };
    const vertex = `
      uniform float uTime;uniform vec2 uMouse;uniform float uPulse;varying vec3 vNormal;varying vec3 vView;varying vec3 vPos;varying vec2 vUv;varying float vNoise;
      void main(){vUv=uv;vec3 p=position;float a=sin(p.x*5.4+uTime*1.2+uMouse.x*2.2);float b=cos(p.y*5.1-uTime*.9+uMouse.y*2.0);float c=sin(p.z*4.2+uTime*.72);float wave=(a*b*.55+c*.45)*(.1+uPulse*.12);p+=normal*wave;p.x+=uMouse.x*.055*(.5+p.y*.3);p.y+=uMouse.y*.055*(.5+p.z*.3);vNoise=wave;vec4 mv=modelViewMatrix*vec4(p,1.);vView=-mv.xyz;vNormal=normalize(normalMatrix*normal);vPos=p;gl_Position=projectionMatrix*mv;}
    `;
    const fragment = `
      precision mediump float;uniform float uTime;uniform float uPulse;varying vec3 vNormal;varying vec3 vView;varying vec3 vPos;varying vec2 vUv;varying float vNoise;
      void main(){vec3 n=normalize(vNormal);vec3 viewDir=normalize(vView);float rim=pow(1.-max(0.,dot(n,viewDir)),2.5);float bands=sin((vPos.x+vPos.y*1.5+vPos.z*.7)*17.+uTime*1.1+vNoise*12.);float heat=smoothstep(-.4,.95,bands+vNoise*3.);vec3 coal=vec3(.025,.035,.03);vec3 blood=vec3(.25,.05,.045);vec3 orange=vec3(1.,.40,.32);vec3 gold=vec3(.94,.92,.82);vec3 acid=vec3(.84,1.,.38);vec3 color=mix(coal,blood,heat*.8);color=mix(color,orange,smoothstep(.28,.9,heat)*.84);color=mix(color,gold,rim*.42+uPulse*.14);color=mix(color,acid,pow(max(0.,bands),5.)*.38);color+=vec3(1.,.25,.20)*rim*(.45+uPulse*.7);float alpha=.94;gl_FragColor=vec4(color,alpha);}
    `;
    let material;
    try {
      material = new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms,
        transparent: true,
        side: THREE.DoubleSide,
      });
    } catch (error) {
      renderer.dispose();
      mount.classList.add("scene-fallback-active");
      return null;
    }
    const geometry = new THREE.IcosahedronGeometry(1.22, 5);
    const core = new THREE.Mesh(geometry, material);
    coreGroup.add(core);
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.27, 2),
      new THREE.MeshBasicMaterial({
        color: 0xd7ff62,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
      }),
    );
    coreGroup.add(wire);
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.42, 1)),
      new THREE.LineBasicMaterial({
        color: 0xff6651,
        transparent: true,
        opacity: 0.78,
      }),
    );
    coreGroup.add(edge);
    const knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.78, 0.018, 180, 5, 2, 5),
      new THREE.MeshBasicMaterial({
        color: 0xff6651,
        transparent: true,
        opacity: 0.9,
      }),
    );
    knot.rotation.set(0.5, 0.2, -0.3);
    coreGroup.add(knot);
    const ringGroup = new THREE.Group();
    root.add(ringGroup);
    const ringSpecs = [
      { r: 1.65, t: 0.008, color: 0xd7ff62, rx: 1.1, ry: 0.25, rz: 0.25 },
      { r: 1.83, t: 0.006, color: 0xff6651, rx: 0.35, ry: 1.2, rz: 0.7 },
      { r: 1.48, t: 0.007, color: 0xf3e9dc, rx: 1.9, ry: 0.75, rz: 1.15 },
    ];
    ringSpecs.forEach((spec, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(spec.r, spec.t, 5, 190),
        new THREE.MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: index === 1 ? 0.65 : 0.4,
        }),
      );
      ring.rotation.set(spec.rx, spec.ry, spec.rz);
      ringGroup.add(ring);
    });
    const particleCount = lowPower ? 230 : 460;
    const pArray = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 1.7 + Math.random() * 1.7;
      const phi = Math.random() * Math.PI * 2;
      const costheta = Math.random() * 2 - 1;
      const sintheta = Math.sqrt(1 - costheta * costheta);
      pArray[i * 3] = radius * sintheta * Math.cos(phi);
      pArray[i * 3 + 1] = radius * costheta;
      pArray[i * 3 + 2] = radius * sintheta * Math.sin(phi);
      const hot = Math.random();
      pColors[i * 3] = hot > 0.78 ? 0.84 : 1;
      pColors[i * 3 + 1] = hot > 0.8 ? 1 : 0.4 + Math.random() * 0.3;
      pColors[i * 3 + 2] = hot > 0.8 ? 0.38 : 0.32;
    }
    const pGeometry = new THREE.BufferGeometry();
    pGeometry.setAttribute("position", new THREE.BufferAttribute(pArray, 3));
    pGeometry.setAttribute("color", new THREE.BufferAttribute(pColors, 3));
    const pMaterial = new THREE.PointsMaterial({
      size: lowPower ? 0.018 : 0.022,
      vertexColors: true,
      transparent: true,
      opacity: 0.83,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pGeometry, pMaterial);
    root.add(points);
    const mouseTarget = { x: 0, y: 0 };
    let visible = true,
      disposed = false,
      last = 0,
      start = performance.now();
    const io = new IntersectionObserver((entries) => {
      visible = Boolean(entries[0]?.isIntersecting) && !document.hidden;
    });
    io.observe(mount);
    const resize = () => {
      const w = Math.max(1, mount.clientWidth),
        h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();
    window.addEventListener(
      "pointermove",
      (e) => {
        mouseTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseTarget.y = (e.clientY / window.innerHeight - 0.5) * -2;
      },
      { passive: true },
    );
    const frame = (now) => {
      if (disposed) return;
      requestAnimationFrame(frame);
      if (
        !visible ||
        document.hidden ||
        now - last < (reducedMotion ? 700 : 33)
      )
        return;
      last = now;
      const time = (now - start) / 1000;
      uniforms.uTime.value = reducedMotion ? 0 : time;
      uniforms.uMouse.value.x +=
        (mouseTarget.x - uniforms.uMouse.value.x) * 0.045;
      uniforms.uMouse.value.y +=
        (mouseTarget.y - uniforms.uMouse.value.y) * 0.045;
      uniforms.uPulse.value += (state.pulse - uniforms.uPulse.value) * 0.06;
      core.rotation.x =
        0.12 +
        uniforms.uMouse.value.y * 0.16 +
        (reducedMotion ? 0 : Math.sin(time * 0.22) * 0.08);
      core.rotation.y =
        time * (reducedMotion ? 0 : 0.16) + uniforms.uMouse.value.x * 0.25;
      wire.rotation.copy(core.rotation);
      wire.rotation.y += 0.07;
      edge.rotation.set(
        core.rotation.x * 0.72,
        core.rotation.y * 0.72,
        -core.rotation.z,
      );
      knot.rotation.x = 0.5 + time * (reducedMotion ? 0 : 0.18);
      knot.rotation.y = 0.2 + time * (reducedMotion ? 0 : 0.24);
      ringGroup.rotation.y = time * (reducedMotion ? 0 : 0.11);
      ringGroup.rotation.x = 0.1 + uniforms.uMouse.value.y * 0.12;
      points.rotation.y = time * (reducedMotion ? 0 : 0.035);
      root.rotation.z = uniforms.uMouse.value.x * 0.045;
      camera.position.x +=
        (uniforms.uMouse.value.x * 0.16 - camera.position.x) * 0.025;
      camera.position.y +=
        (uniforms.uMouse.value.y * 0.12 - camera.position.y) * 0.025;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      const entropy = $("#entropy-value");
      if (entropy && Math.floor(time * 2) % 2 === 0)
        entropy.textContent = (
          68 +
          Math.abs(Math.sin(time * 0.7)) * 29
        ).toFixed(1);
    };
    requestAnimationFrame(frame);
    return {
      pulse() {
        state.pulse = 1;
        window.setTimeout(() => (state.pulse = 0), 950);
      },
      resize,
      dispose() {
        disposed = true;
        ro.disconnect();
        io.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
      },
    };
  }

  // ---------- Page interactions and motion ----------
  function initCursor() {
    if (
      reducedMotion ||
      lowPower ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;
    const core = $("#cursor-core"),
      caption = $("#cursor-caption");
    if (!core || !caption) return;
    document.body.classList.add("has-custom-cursor");
    let x = window.innerWidth / 2,
      y = window.innerHeight / 2,
      tx = x,
      ty = y,
      raf = 0;
    core.style.opacity = "1";
    const render = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      core.style.transform = `translate3d(${x - 9}px,${y - 9}px,0)`;
      caption.style.transform = `translate3d(${x + 17}px,${y + 17}px,0)`;
      raf = requestAnimationFrame(render);
    };
    render();
    window.addEventListener(
      "pointermove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        state.pointerX = e.clientX / window.innerWidth;
        state.pointerY = e.clientY / window.innerHeight;
      },
      { passive: true },
    );
    $$("a,button,.project-open,[data-auth-open]").forEach((el) => {
      el.addEventListener("pointerenter", () => {
        core.classList.add("is-hover");
        caption.classList.add("is-visible");
        const text =
          el.dataset.cursor ||
          (el.hasAttribute("data-open-project")
            ? "OPEN FILE"
            : el.hasAttribute("data-auth-open")
              ? "ACCESS"
              : "EXPLORE");
        caption.textContent = text;
      });
      el.addEventListener("pointerleave", () => {
        core.classList.remove("is-hover");
        caption.classList.remove("is-visible");
      });
    });
  }

  function initProgress() {
    const fill = $("#reading-bar-fill"),
      num = $("#scroll-readout-value"),
      line = $("#scroll-readout-line");
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (fill) fill.style.width = `${progress * 100}%`;
      if (num)
        num.textContent = String(Math.round(progress * 100)).padStart(2, "0");
      if (line) line.style.height = `${progress * 100}%`;
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  function initLoader(onComplete) {
    const loader = $("#preloader");
    if (!loader) {
      onComplete();
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(window.__infernoSafetyTimer);
      document.documentElement.classList.add("intro-complete");
      if (window.gsap && !reducedMotion) {
        gsap
          .timeline({
            onComplete: () => {
              loader.remove();
              onComplete();
            },
          })
          .to(
            loader,
            {
              duration: 0.48,
              scaleY: 0,
              transformOrigin: "bottom",
              ease: "power4.inOut",
            },
            0,
          )
          .to(
            ".loader-exit",
            {
              duration: 0.42,
              scaleY: 1,
              transformOrigin: "bottom",
              ease: "power4.inOut",
            },
            0,
          )
          .set(loader, { display: "none" });
      } else {
        loader.remove();
        onComplete();
      }
    };
    window.__infernoSafetyTimer = window.setTimeout(finish, 5200);
    if (!window.gsap || reducedMotion) {
      $("#loader-progress-fill").style.width = "100%";
      $("#loader-percent").textContent = "100%";
      window.setTimeout(finish, 700);
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(
      ".loader-logo",
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.42, ease: "power3.out" },
      0,
    )
      .fromTo(
        ".loader-top>span",
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.07, ease: "power2.out" },
        0.08,
      )
      .to(
        ".sigil-path",
        {
          strokeDashoffset: 0,
          duration: 0.75,
          stagger: 0.12,
          ease: "power2.out",
        },
        0.12,
      )
      .fromTo(
        ".loader-stage h1",
        { yPercent: 24, opacity: 0, filter: "blur(9px)" },
        {
          yPercent: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.62,
          ease: "power4.out",
        },
        0.28,
      )
      .fromTo(
        ".loader-description,.loader-overline",
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.08, ease: "power2.out" },
        0.52,
      )
      .fromTo(
        ".loader-bottom",
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" },
        0.25,
      )
      .to(
        "#loader-progress-fill",
        { width: "100%", duration: 1.28, ease: "power2.inOut" },
        0.1,
      )
      .to(
        { val: 0 },
        {
          val: 100,
          duration: 1.28,
          ease: "power2.inOut",
          onUpdate() {
            const val = Math.round(this.targets()[0].val);
            $("#loader-percent").textContent =
              `${String(val).padStart(2, "0")}%`;
            if (val < 35) {
              $("#loader-step").textContent = "01 / IGNITION";
              $("#loader-detail").textContent = "Loading the visual system";
            } else if (val < 72) {
              $("#loader-step").textContent = "02 / SHAPING";
              $("#loader-detail").textContent =
                "Preparing geometry and atmosphere";
            } else {
              $("#loader-step").textContent = "03 / RELEASE";
              $("#loader-detail").textContent = "Warming up the strange stuff";
            }
          },
        },
        0.1,
      )
      .to(".loader-description", { opacity: 0.4, duration: 0.16 }, 1.33)
      .call(finish, [], 1.55);
  }

  function initProjects() {
    const grid = $("#project-grid"),
      count = $("#work-count"),
      filters = $$("[data-filter]");
    if (!grid) return;
    let lastFocus = null;
    const typeLabel = (t) =>
      t === "All work" ? "ALL SIGNALS" : t.toUpperCase();
    function card(project) {
      return `<article class="project-card" data-project-id="${project.id}"><button class="project-open" data-open-project="${project.id}" data-cursor="VIEW FILE" type="button" aria-label="Open details for ${project.title}"><div class="project-visual"><img src="images/project-${project.id}-preview.webp" alt="Screenshot preview of ${project.title}" width="1000" height="650" loading="${project.id < 3 ? "eager" : "lazy"}"><span class="project-number"><b>${String(project.id).padStart(2, "0")}</b> / 09</span><span class="project-view" aria-hidden="true">↗</span><span class="project-visual-label">OPEN ARTIFACT <span>↗</span></span></div><div class="project-info"><div><p class="project-type">${project.label}</p><h3>${project.title}</h3><div class="project-info-bottom"><i></i><span>${String(project.id).padStart(2, "0")} / WEB EXPERIMENT</span></div></div><span class="project-arrow" aria-hidden="true">↗</span></div></button></article>`;
    }
    function render(filter = state.activeFilter) {
      state.activeFilter = filter;
      const visible =
        filter === "All work"
          ? projects
          : projects.filter((p) => p.type === filter);
      grid.innerHTML = visible.map(card).join("");
      grid.classList.toggle("is-filtered", filter !== "All work");
      count.textContent = `TRANSMITTING ${String(visible.length).padStart(2, "0")} PROJECT${visible.length === 1 ? "" : "S"}`;
      filters.forEach((b) => {
        const active = b.dataset.filter === filter;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      if (window.gsap && !reducedMotion) {
        gsap.fromTo(
          $$(".project-card", grid),
          { y: 36, opacity: 0, rotateX: 3 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 0.8,
            stagger: 0.07,
            ease: "power3.out",
            clearProps: "transform",
            onComplete: () => initProjectCardMotion(),
          },
        );
      } else initProjectCardMotion();
    }
    function open(id) {
      const p = projects.find((x) => x.id === Number(id));
      if (!p) return;
      lastFocus = document.activeElement;
      $("#modal-kicker").textContent =
        `ARTIFACT / ${String(p.id).padStart(2, "0")}`;
      $("#modal-label").textContent = p.label.toUpperCase();
      $("#modal-title").innerHTML = `${p.title}<span>.</span>`;
      $("#modal-description").textContent = p.note;
      $("#modal-type").textContent = p.type;
      $("#modal-live-link").href = p.href;
      $("#modal-url-label").textContent = p.href.replace(/^https:\/\//, "");
      const img = $("#modal-preview-image");
      img.src = `images/project-${p.id}-full.webp`;
      img.alt = `Full-page screenshot of ${p.title}`;
      $("#project-modal-backdrop").hidden = false;
      document.body.classList.add("is-modal-open");
      $("#modal-close").focus();
      if (window.gsap && !reducedMotion)
        gsap.fromTo(
          "#project-modal",
          { y: 35, opacity: 0, scale: 0.97, clipPath: "inset(8% 0 0 0)" },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            clipPath: "inset(0% 0 0 0)",
            duration: 0.55,
            ease: "power4.out",
          },
        );
    }
    function close() {
      const backdrop = $("#project-modal-backdrop");
      if (backdrop.hidden) return;
      const done = () => {
        backdrop.hidden = true;
        document.body.classList.remove("is-modal-open");
        if (lastFocus?.focus) lastFocus.focus();
      };
      if (window.gsap && !reducedMotion)
        gsap.to("#project-modal", {
          y: 16,
          opacity: 0,
          duration: 0.25,
          ease: "power2.in",
          onComplete: done,
        });
      else done();
    }
    filters.forEach((btn) =>
      btn.addEventListener("click", () => render(btn.dataset.filter)),
    );
    grid.addEventListener("click", (e) => {
      const button = e.target.closest("[data-open-project]");
      if (button) open(button.dataset.openProject);
    });
    $("#modal-close")?.addEventListener("click", close);
    $("#project-modal-backdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "project-modal-backdrop") close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && !$("#project-modal-backdrop").hidden) {
        const modal = $("#project-modal");
        const focusable = $$(
          'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
          modal,
        );
        if (
          focusable.length &&
          e.shiftKey &&
          document.activeElement === focusable[0]
        ) {
          e.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (
          focusable.length &&
          !e.shiftKey &&
          document.activeElement === focusable[focusable.length - 1]
        ) {
          e.preventDefault();
          focusable[0].focus();
        }
      }
    });
    render();
  }

  function initProjectCardMotion() {
    if (
      reducedMotion ||
      lowPower ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;
    $$(".project-open").forEach((card) => {
      if (card.dataset.tiltReady) return;
      card.dataset.tiltReady = "true";
      const visual = $(".project-visual", card);
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        if (window.gsap)
          gsap.to(visual, {
            rotateY: x * 3.8,
            rotateX: -y * 3.2,
            transformPerspective: 700,
            transformOrigin: "center",
            duration: 0.42,
            ease: "power2.out",
            overwrite: true,
          });
      });
      card.addEventListener("pointerleave", () => {
        if (window.gsap)
          gsap.to(visual, {
            rotateY: 0,
            rotateX: 0,
            duration: 0.5,
            ease: "power3.out",
            overwrite: true,
          });
      });
    });
  }

  function initNavigation() {
    const toggle = $("#menu-toggle"),
      nav = $("#primary-navigation");
    if (!toggle || !nav) return;
    const close = () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    };
    toggle.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    $$("a,button", nav).forEach((el) => el.addEventListener("click", close));
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1100) close();
    });
  }

  function initMotion() {
    if (!window.gsap || reducedMotion) return;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    let lenis = null;
    if (window.Lenis && !lowPower) {
      try {
        lenis = new Lenis({
          duration: 1.08,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          orientation: "vertical",
          gestureOrientation: "vertical",
          wheelMultiplier: 0.85,
          touchMultiplier: 1.1,
          anchors: true,
        });
        if (window.ScrollTrigger)
          lenis.on("scroll", () => window.ScrollTrigger.update());
        gsap.ticker.add((time) => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
        window.__adibLenis = lenis;
      } catch (error) {
        console.warn("Smooth-scroll enhancement skipped.", error);
      }
    }
    const hero = gsap.timeline({ defaults: { ease: "power4.out" } });
    hero
      .fromTo(
        ".topbar",
        { y: -25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8 },
        0,
      )
      .fromTo(
        ".hero-stamp-row",
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65 },
        0.08,
      )
      .fromTo(
        ".title-line",
        { yPercent: 120, rotate: 2, filter: "blur(11px)" },
        {
          yPercent: 0,
          rotate: 0,
          filter: "blur(0px)",
          duration: 1.05,
          stagger: 0.14,
        },
        0.15,
      )
      .fromTo(
        ".hero-deck-row",
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        0.62,
      )
      .fromTo(
        ".hero-art-column",
        { y: 45, scale: 0.94, opacity: 0, rotate: 2 },
        { y: 0, scale: 1, opacity: 1, rotate: 0, duration: 1.1 },
        0.27,
      )
      .fromTo(
        ".hero-bottom-rail",
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65 },
        0.8,
      )
      .fromTo(
        ".hero-giant-side,.hero-scroll-hint",
        { opacity: 0 },
        { opacity: 1, duration: 0.7, stagger: 0.12 },
        0.85,
      );
    $$(".reveal").forEach((element, index) => {
      gsap.fromTo(
        element,
        { y: 34, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          ease: "power3.out",
          clearProps: "transform,opacity",
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        },
      );
    });

    if (window.ScrollTrigger) {
      $$(".project-card").forEach((card, index) => {
        const visual = $(".project-visual", card);
        gsap.fromTo(
          visual,
          {
            clipPath:
              index % 3 === 0
                ? "polygon(0 100%,100% 100%,100% 100%,0 100%)"
                : "inset(0 0 100% 0)",
            y: 40,
            scale: 0.96,
          },
          {
            clipPath: "inset(0 0 0% 0)",
            y: 0,
            scale: 1,
            duration: 1.15,
            ease: "power4.out",
            scrollTrigger: { trigger: card, start: "top 86%", once: true },
          },
        );
        gsap.fromTo(
          $(".project-info", card),
          { y: 18, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            delay: 0.1,
            ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 80%", once: true },
          },
        );
      });
      gsap.fromTo(
        ".manifesto-title span:first-child",
        { xPercent: -8, opacity: 0.2 },
        {
          xPercent: 0,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".manifesto-section",
            start: "top 72%",
            end: "top 15%",
            scrub: 1,
          },
        },
      );
      gsap.fromTo(
        ".manifesto-title span:nth-child(2)",
        { xPercent: 8 },
        {
          xPercent: 0,
          ease: "none",
          scrollTrigger: {
            trigger: ".manifesto-section",
            start: "top 72%",
            end: "top 15%",
            scrub: 1,
          },
        },
      );
      gsap.fromTo(
        ".manifesto-bg-shape",
        { rotation: -18, scale: 0.86 },
        {
          rotation: 22,
          scale: 1.12,
          ease: "none",
          scrollTrigger: {
            trigger: ".manifesto-section",
            start: "top bottom",
            end: "bottom top",
            scrub: 1.4,
          },
        },
      );
      gsap.to(".hero-scene", {
        yPercent: 10,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
      gsap.to(".hero-copy", {
        yPercent: 14,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero",
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      });
      gsap.fromTo(
        ".field-viewport",
        { clipPath: "polygon(0 0,100% 0,100% 0,0 0)", scale: 0.97 },
        {
          clipPath: "polygon(0 0,100% 0,100% 100%,0 100%)",
          scale: 1,
          duration: 1.15,
          ease: "power3.inOut",
          scrollTrigger: {
            trigger: ".field-viewport",
            start: "top 85%",
            once: true,
          },
        },
      );
      gsap.to(".field-overlay-shapes", {
        rotation: 6,
        scale: 1.12,
        ease: "none",
        scrollTrigger: {
          trigger: ".field-viewport",
          start: "top bottom",
          end: "bottom top",
          scrub: 1.3,
        },
      });
      gsap.fromTo(
        ".about-card-photo",
        { rotation: 9, y: 45 },
        {
          rotation: 4.5,
          y: 0,
          ease: "none",
          scrollTrigger: {
            trigger: ".about-art",
            start: "top bottom",
            end: "center center",
            scrub: 1,
          },
        },
      );
      gsap.to(".end-shape-a", {
        rotation: 90,
        scale: 1.12,
        ease: "none",
        scrollTrigger: {
          trigger: ".end-section",
          start: "top bottom",
          end: "bottom bottom",
          scrub: 1.6,
        },
      });
      gsap.fromTo(
        ".end-title em",
        { xPercent: -6 },
        {
          xPercent: 2,
          ease: "none",
          scrollTrigger: {
            trigger: ".end-section",
            start: "top 80%",
            end: "bottom bottom",
            scrub: 1,
          },
        },
      );
    }

    if (
      !lowPower &&
      window.matchMedia("(hover:hover) and (pointer:fine)").matches
    ) {
      $$(".end-contact-button,.hero-jump,.nav-member").forEach((button) => {
        const qx = gsap.quickTo(button, "x", {
            duration: 0.3,
            ease: "power3.out",
          }),
          qy = gsap.quickTo(button, "y", { duration: 0.3, ease: "power3.out" });
        button.addEventListener("pointermove", (e) => {
          const r = button.getBoundingClientRect();
          qx((e.clientX - r.left - r.width / 2) * 0.1);
          qy((e.clientY - r.top - r.height / 2) * 0.1);
        });
        button.addEventListener("pointerleave", () => {
          qx(0);
          qy(0);
        });
      });
    }
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  function initFieldPulse() {
    const button = $("#field-pulse");
    button?.addEventListener("click", () => {
      state.fieldPulse = 1;
      state.pulse = 1;
      fieldScene?.pulse();
      heroScene?.pulse();
      if (window.gsap && !reducedMotion) {
        gsap.fromTo(
          ".field-reticle",
          { scale: 0.55, opacity: 1 },
          {
            scale: 1.6,
            opacity: 0,
            duration: 0.75,
            ease: "power2.out",
            onComplete: () =>
              gsap.set(".field-reticle", { scale: 1, opacity: 1 }),
          },
        );
        gsap.fromTo(
          ".field-overlay-shapes",
          { opacity: 0.25 },
          {
            opacity: 1,
            duration: 0.14,
            yoyo: true,
            repeat: 3,
            ease: "sine.inOut",
          },
        );
      }
      window.setTimeout(() => {
        state.fieldPulse = 0;
        state.pulse = 0;
      }, 900);
    });
  }

  let smokeScene = null,
    fieldScene = null,
    heroScene = null;
  function boot() {
    window.addEventListener(
      "pointermove",
      (event) => {
        state.pointerX = event.clientX / Math.max(1, window.innerWidth);
        state.pointerY = event.clientY / Math.max(1, window.innerHeight);
      },
      { passive: true },
    );
    smokeScene = initInfernoSmoke();
    fieldScene = initFieldShader();
    heroScene = initHeroScene();
    initProgress();
    initProjects();
    initNavigation();
    initCursor();
    initFieldPulse();
    initLoader(() => {
      document.documentElement.classList.add("motion-ready");
      initMotion();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
    if (!window.THREE) $("#hero-scene")?.classList.add("scene-fallback-active");
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && window.ScrollTrigger) ScrollTrigger.refresh();
    });
    window.addEventListener("load", () => {
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
    window.addEventListener("beforeunload", () => {
      smokeScene?.destroy();
      fieldScene?.destroy();
      heroScene?.dispose();
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
