# WebGL-HeatMap
###基于webgl的 热力图插件
##[Demo](http://wshxbqq-wshxbqq.stor.sinaapp.com/2016-02-15_16-49-51_518___demo.html)
#####使用方法
```javascript
var fakeData = [];
    for (var i = 0; i < 10000; i++) {
        fakeData.push([Math.random() * 2048, Math.random() * 900, Math.floor(Math.random() * 600)]);
    }


    var z = WebGLCanvas.render({
        width:1024,
        height:100,
        radius: 18,
        max: 800,
        min: 100,
        filter: 12
    }, fakeData);
    for (var i = 0; i < z.length; i++) {
        document.body.appendChild(z[i]);
    };
```

可以看到 插件需要的数据格式为 fakeData 提供的格式。


`WebGLCanvas.render(cfg,data)` 方法返回的是一个 多个canvas的数组。



你只需要把这些canvas append 到dom树中就行


注意 render 方法里面的 width 和 height 很可能不是最后生成的 canvas的实际尺寸，因为gl中要求每个纹理的尺寸必须是2的n次方。


![img](http://wshxbqq-wshxbqq.stor.sinaapp.com/2016-02-15_16-40-07_884___2.png)


![img](http://wshxbqq-wshxbqq.stor.sinaapp.com/2016-02-15_16-36-59_476___1.png)
