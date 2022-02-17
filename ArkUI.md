# ArkUI





## 类web开发范式

类Web开发范式，采用经典的HML、CSS、JavaScript三段式开发方式。使用HML标签文件进行布局搭建，使用CSS文件进行样式描述，使用JavaScript文件进行逻辑处理。UI组件与数据之间通过单向数据绑定的方式建立关联，当数据发生变化时，UI界面自动触发更新。此种开发方式，更接近Web前端开发者的使用习惯，`快速将已有的Web应用改造成方舟开发框架应用`，主要适用于界面较为简单的`中小型应用开发`。


## 声明式开发范式

声明式开发范式，采用TS语言并进行声明式UI语法扩展，从组件、动效和`状态管理`三个维度提供了UI绘制能力。UI开发更接近自然语义的编程方式，让开发者直观地描述UI界面，不必关心框架如何实现UI绘制和渲染，实现极简高效开发。同时，选用有类型标注的TS语言，引入编译期的类型校验，更适用`大型的应用开发`。



## 开发范式对比
|  开发范式   | 语言  | UI更新方式 | 适合场景 | 适合人群 |
|  ----  | ----  |  ----  | ----  | ----  |
| 类web开发范式  | js | 数据驱动更新 | 界面较为简单的类小程序应用和卡片 | Web前端开发人员 |
| 声明式开发范式  | ets(扩展的ts语言) | 数据驱动更新 | 复杂度较大、团队合作度较高的程序 | 移动系统应用开发人员、系统应用开发人员 |



## 框架结构

![框架结构](https://alliance-communityfile-drcn.dbankcdn.com/FileServer/getFile/cmtyPub/011/111/111/0000000000011111111.20211217153624.60341076590267765575103813935075:50521216093352:2800:5849BC0045F1B7C9A9982BEB54D94C1E83B55A239A5A28F0561CFE5FB88C257A.png?needInitFileName=true?needInitFileName=true)


相同点：UI后端引擎和语言运行时是一样的

不同点：`声明式开发范式`无需JS Framework进行页面DOM管理，渲染更新链路更为精简，占用内存更少。 




## 语法对比
类web开发范式的语法，总的来讲，跟`vue2` 、 `小程序`的语法很相似，每个组件对应了xx.hml的模板文件、xx.css的样式文件、xx.js的脚本文件。
```html
<!-- comp.hml -->
<div class="container" onswipe="touchMove">
    <text class="title">
        {{ $t('strings.hello') }} {{ title }}
    </text>
    <input class="btn" type="button" value="{{ $t('strings.next') }}" onclick="onclick"></input>
</div>

```
```css
/* comp.css */
.container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    left: 0px;
    top: 0px;
    width: 100%;
    height: 100%;
}
.title {
    font-size: 60px;
    text-align: center;
    width: 100%;
    height: 40%;
    margin: 10px;
}
.btn {
    width: 50%;
    height: 100px;
    font-size: 40px;
}
```
```js
// comp.js
import router from '@system.router'
export default {
    data: {
        title: ""
    },
    onInit() {
        this.title = this.$t('strings.world');
    },
    onclick: function () {
        router.replace({
            uri: "pages/second/second"
        })
    }
}
```
![语法](https://5fou.com/i/2022/02/16/rcc9oa.png)

总的来说，让熟悉vue，小程序开发的人也能很快使用类web开发范式的语法来开发鸿蒙应用。





声明式开发范式，不像传统的web开发，像 `flutter` 一样用原子化的布局函数组合 UI,开发方式如下，视图布局写在build方法内

```js
@Preview
@Entry
@Component
struct Index {
  build() {
    Flex({ direction: FlexDirection.Column, alignItems: ItemAlign.Center, justifyContent: FlexAlign.Center }) {
      Text('Hello World')
        .fontSize(50)
        .fontWeight(FontWeight.Bold)
      Button() {
        Text('next page')
          .fontSize(25)
          .fontWeight(FontWeight.Bold)
      }.type(ButtonType.Normal)
      .margin({
        top: 30
      })
      .backgroundColor('#0D9FFB')
      .onClick(() => {
        routePage()
      })
    }
    .width('100%')
    .height('100%')
  }
}
```

![语法](https://seikim.com/i/2022/02/16/qxd05a.png)

 
声明式范式在UI状态管理方面，比类web范式功能更加强大，支持父子间的数据单向，双向绑定，而且也提供了管理应用程序的状态的单例对象AppStorage，由UI框架在应用程序启动时创建。它的目的是为可变应用程序状态属性提供中央存储，还支持祖辈之间通信等，所以声明式范式开发更适合复杂度较高的项目，开发者对组件拆分颗粒度要求较高。
而类web开发范式开发更适合较简单的，将已有web项目改造成方舟开发框架应用