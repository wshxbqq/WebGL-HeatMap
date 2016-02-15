var WebGLCanvas = {};
WebGLCanvas.vertexShader="\
        attribute vec4 a_Position;\
        uniform vec2 u_resolution;\
        uniform float u_maxClick;\
        uniform float u_minClick;\
        uniform float u_filterClick;\
        attribute float a_click;\
        attribute vec2 a_center;\
        attribute float a_radius;\
        varying vec2 v_center;\
        varying vec2 v_resolution;\
        varying float v_radius;\
        varying float v_maxClick;\
        varying float v_minClick;\
        varying float v_filterClick;\
        varying float v_click;\
        void main() {\
                gl_PointSize = a_radius * 2.0;\
                vec2 clipspace = a_center / u_resolution * 2.0 - 1.0;\
                gl_Position = vec4(clipspace * vec2(1, -1), 0, 1);\
                v_center = a_center;\
                v_resolution = u_resolution;\
                v_radius = a_radius - 1.0;\
                v_maxClick = u_maxClick;\
                v_minClick = u_minClick;\
                v_filterClick = u_filterClick;\
                v_click = a_click; \
        }";

WebGLCanvas.fragmentShader="\
        precision mediump float;\
        varying vec2 v_center;\
        varying vec2 v_resolution;\
        varying float v_radius;\
        varying float v_maxClick;\
        varying float v_minClick;\
        varying float v_filterClick;\
        varying float v_click;\
        varying float v_groupIdx;\
        void main() {\
                vec4 color0 = vec4(0.0, 0.0, 0.0, 0.0);\
                float x = gl_FragCoord.x;\
                float y = v_resolution[1] - gl_FragCoord.y;\
                float dx = v_center[0] - x;\
                float dy = v_center[1] - y;\
                float distance = sqrt(dx*dx + dy*dy);\
                float diff = v_radius-distance;\
                float currentPercent=0.95;\
                float blurFactory=0.55;\
                float pxAlpha=0.0;\
                if(v_maxClick>= v_click && v_click>= v_minClick){\
                    pxAlpha = (v_click-v_minClick)/(v_maxClick-v_minClick);\
                }\
                if(v_click>= v_maxClick){\
                    pxAlpha = 1.0;\
                }\
                if ( diff >  0.0 ) {\
                    if(diff > v_radius * blurFactory) {\
                        gl_FragColor = vec4(0,0,0,pxAlpha);\
                    } else {\
                        float p=diff/(v_radius*blurFactory);\
                        gl_FragColor = vec4(0,0,0,p*pxAlpha);\
                    }\
                } else {\
                    if ( diff >= 0.0 && diff <= 1.0 ){\
                    }\
                    else{\
                        gl_FragColor = vec4(0,0,0,0);\
                    }\
                }\
        }";
WebGLCanvas.vertexShader1="\
        attribute vec4 a_Position;\
        void main(void){\
            gl_Position = a_Position;\
        }";

WebGLCanvas.fragmentShader1="\
        precision mediump float;\
        uniform vec2 u_resolution;\
        uniform sampler2D u_Sampler;\
        vec3 getColorByPercent(float pct){\
            vec3 v3=vec3(0.0,0.0,pct);\
            if(pct>0.85){\
                return vec3(1.0,1.0-(pct-0.85)/0.15,0.0);\
            }\
            if(pct>0.55){\
                return vec3((pct-0.55)/0.3,1.0,0.0);\
            }\
            if(pct>0.25){\
                return vec3(0.0,(pct-0.25)/0.3, 1.0-(pct-0.25)/0.3);\
            }\
            if(pct>0.0){\
                return vec3(0.0,0.0,1.0);\
            }\
            return v3;\
        }\
        void main(void){\
            vec4 c=texture2D(u_Sampler, vec2(gl_FragCoord.x/u_resolution[0],gl_FragCoord.y/u_resolution[1]));\
            float p_alpha=c[3];\
            if(p_alpha>0.0){\
                 gl_FragColor = vec4(getColorByPercent(p_alpha),p_alpha) ;\
            }\
        }"

WebGLCanvas.bufferCuter = function(arr) {
    var buffers = [];
    var _cur;
    _cur = arr.splice(0, 3000);
    while (_cur.length > 0) {
        buffers.push(_cur);
        _cur = arr.splice(0, 3000);
    }

    for (var i in buffers) {
        var d = [];
        var j = 0;
        var groupIdx = 0;
        for (var _i in buffers[i]) {
            var pointData = buffers[i][_i];
            d[j++] = pointData[0];
            d[j++] = pointData[1];
            d[j++] = pointData[2];
        }
        buffers[i] = new Float32Array(d);


    }
    return buffers;

}

WebGLCanvas.createTplCanvas = function(cfg, data) {

    var tplCanvas = document.createElement("canvas");

    tplCanvas.glObj = {
        canvas: tplCanvas,
        data: data,
        cfg: cfg
    };
    tplCanvas.width = cfg.width||2048;
    tplCanvas.height = cfg.height||1024;

    // webgl的context获取
    var gl = tplCanvas.glObj.gl = tplCanvas.getContext('webgl');
    // 设定canvas初始化的颜色
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // 设定canvas初始化时候的深度


    gl.disable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 顶点着色器和片段着色器的生成
    var v_shader = create_shader(gl, 'v', WebGLCanvas.vertexShader);
    var f_shader = create_shader(gl, 'f', WebGLCanvas.fragmentShader);

    var v_shader1 = create_shader(gl, 'v', WebGLCanvas.vertexShader1);
    var f_shader1 = create_shader(gl, 'f', WebGLCanvas.fragmentShader1);

    // 程序对象的生成和连接
    var programNode = tplCanvas.glObj.programNode = create_program(gl, v_shader, f_shader);
    gl.useProgram(programNode);



    // // 顶点着色器和片段着色器的生成
    // var v_shader1 = create_shader(gl, 'v', vs1.innerHTML);
    // var f_shader1 = create_shader(gl, 'f', fs1.innerHTML);

    // // 程序对象的生成和连接
    // var programNode1 = create_program(gl, v_shader1, f_shader1);




    // attributeLocation的获取

    gl.enable(gl.BLEND); //首先要启用混合
    gl.blendEquation(gl.FUNC_ADD); //相加
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); //源色和现有色的相加


    var resolutionLocation = tplCanvas.glObj.resolutionLocation = gl.getUniformLocation(programNode, "u_resolution");

    var centerLocation = tplCanvas.glObj.centerLocation = gl.getAttribLocation(programNode, "a_center");
    var radiusLocation = tplCanvas.glObj.radiusLocation = gl.getAttribLocation(programNode, "a_radius");
    var a_clickLocation = tplCanvas.glObj.a_clickLocation = gl.getAttribLocation(programNode, "a_click");

    var u_maxClickLocation = tplCanvas.glObj.u_maxClickLocation = gl.getUniformLocation(programNode, "u_maxClick");
    var u_minClickLocation = tplCanvas.glObj.u_minClickLocation = gl.getUniformLocation(programNode, "u_minClick");
    var u_filterClickLocation = tplCanvas.glObj.u_filterClickLocation = gl.getUniformLocation(programNode, "u_filterClick");





    gl.uniform2f(resolutionLocation, tplCanvas.width, tplCanvas.height);



    function draw() {

        gl.uniform1f(u_maxClickLocation, tplCanvas.glObj.cfg.max);
        gl.uniform1f(u_minClickLocation, tplCanvas.glObj.cfg.min);
        gl.uniform1f(u_filterClickLocation, tplCanvas.glObj.cfg.filter);


        gl.vertexAttrib1f(radiusLocation, tplCanvas.glObj.cfg.radius + 1);



        var fb = gl.createFramebuffer();


        // create an empty texture
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tplCanvas.width, tplCanvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        fb.texture = tex;


        var depthBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorage(
            gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, tplCanvas.width, tplCanvas.height
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
            alert("this combination of attachments does not work");
            return;
        }


        gl.viewport(0, 0, tplCanvas.width, tplCanvas.height);







        var ATTRIBUTES = 3;
        for (var i in tplCanvas.glObj.data) {

            var f32Arr = tplCanvas.glObj.data[i];

            var dataBuffer = f32Arr;
            var buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

            gl.bufferData(
                gl.ARRAY_BUFFER,
                dataBuffer,
                gl.STATIC_DRAW
            );



            gl.enableVertexAttribArray(centerLocation);
            gl.enableVertexAttribArray(a_clickLocation);



            gl.vertexAttribPointer(centerLocation, 2, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT * 0);
            gl.vertexAttribPointer(a_clickLocation, 1, gl.FLOAT, false, ATTRIBUTES * Float32Array.BYTES_PER_ELEMENT, Float32Array.BYTES_PER_ELEMENT * 2);

            gl.drawArrays(gl.POINTS, 0, f32Arr.length / ATTRIBUTES);


        }




        // 程序对象的生成和连接
        var programNode1 = tplCanvas.glObj.programNode1 = create_program(gl, v_shader1, f_shader1);
        gl.useProgram(programNode1);

        var a_Position = gl.getAttribLocation(programNode1, 'a_Position');

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);


        var resolutionLocation = gl.getUniformLocation(programNode1, "u_resolution");
        gl.uniform2f(resolutionLocation, tplCanvas.width, tplCanvas.height);



        var verts = [-1, -1, -1, 1,
            1, -1,
            1, 1
        ];
        var vertBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.deleteFramebuffer(fb);
    }
    draw();






    window.gl = gl;



    tplCanvas.resetCfg = function(cfg) {

        var gl = this.glObj.gl;
        gl.useProgram(programNode);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        tplCanvas.glObj.cfg = cfg;
        draw();


    }


    return tplCanvas;

};





WebGLCanvas.dataCuter = function(cfg,data, margin) {
    var result = [];

    for (var i in data) {
        for (var j in data[i]) {
            data[i][j] = parseInt(data[i][j]);
        }
    };

    var _data = data.sort(function(a, b) {
        return a[1] - b[1];
    });
    var idx = 0;

    for (var i in data) {
        var p = data[i];
        var x = p[0];
        var y = p[1];
        var c = p[2];

        var modY = y % cfg.height;

        var gp = Math.floor(y / cfg.height);
        if (!result[gp]) { result[gp] = [] }
        result[gp].push([x, y - gp * cfg.height, c]);
        if (cfg.height - modY < margin) {
            if (!result[gp + 1]) { result[gp + 1] = [] }
            result[gp + 1].push([x, y - (gp + 1) * cfg.height, c]);
        }

        if (modY < margin) {
            if (gp - 1 >= 0) {

                if (!result[gp - 1]) { result[gp - 1] = [] };
                result[gp - 1].push([x, cfg.height + modY, c]);
            }
        }


    }
    return result;


}

WebGLCanvas.getNearPower=function(num){
    var _vernier=2;
    while(_vernier<num){
        _vernier=_vernier*2;
    }
    return _vernier;
}


WebGLCanvas.render=function(cfg,data){
    cfg.width=WebGLCanvas.getNearPower(cfg.width);
    cfg.height=WebGLCanvas.getNearPower(cfg.height);

    var canvasQueue=[];
    var cutedData = WebGLCanvas.dataCuter(cfg,data, 30);
    for (var i in cutedData) {
        var bufferChip = WebGLCanvas.bufferCuter(cutedData[i]);
        var canvas = WebGLCanvas.createTplCanvas(cfg, bufferChip);
        canvasQueue.push(canvas);
    }
    return canvasQueue;
    
}

WebGLCanvas.reset=function (cfg,canvasArr) {
    for (var i in canvasArr) {
        canvasArr[i].resetCfg(cfg)
    }
}




































// 生成着色器的函数
function create_shader(gl, type, source) {
    // 用来保存着色器的变量
    var shader;
    switch (type) {
        // 顶点着色器的时候
        case 'v':
            shader = gl.createShader(gl.VERTEX_SHADER);
            break;

            // 片段着色器的时候
        case 'f':
            shader = gl.createShader(gl.FRAGMENT_SHADER);
            break;
        default:
            return;
    }

    // 将标签中的代码分配给生成的着色器
    gl.shaderSource(shader, source);

    // 编译着色器
    gl.compileShader(shader);

    // 判断一下着色器是否编译成功
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {

        // 编译成功，则返回着色器
        return shader;
    } else {

        // 编译失败，弹出错误消息
        alert(gl.getShaderInfoLog(shader));
    }
}

// 程序对象的生成和着色器连接的函数
function create_program(gl, vs, fs) {
    // 程序对象的生成
    var program = gl.createProgram();

    // 向程序对象里分配着色器
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);

    // 将着色器连接
    gl.linkProgram(program);

    // 判断着色器的连接是否成功
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {

        // 成功的话，将程序对象设置为有效
        //gl.useProgram(program);

        // 返回程序对象
        return program;
    } else {

        // 如果失败，弹出错误信息
        alert(gl.getProgramInfoLog(program));
    }
}

// 生成VBO的函数
function create_vbo(data) {
    // 生成缓存对象
    var vbo = gl.createBuffer();

    // 绑定缓存
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    // 向缓存中写入数据
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

    // 将绑定的缓存设为无效
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // 返回生成的VBO
    return vbo;
}
