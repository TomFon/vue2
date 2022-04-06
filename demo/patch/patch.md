# vue2 patch 分析
前文我们已经讲解了vue2的响应式原理，即是当数据发生变化时如何通知订阅者更新，本篇则将订阅者是如何更新变化的。


## Vnode

### 什么是Vnode
`virtual node`是全称，也就是平时我们所讲的虚拟节点。用来记录真实节点信息的。让我们看看这个vnode的结构
代码位于`src/core/vdom/vnode.js`
```javascript
    this.tag = tag // 标签名称
    this.data = data // 数据
    this.children = children // 子节点数组
    this.text = text // 文本内容
    this.elm = elm  // 真实dom
    this.ns = undefined // 命名空间
    this.context = context // 当前节点vue实例
    this.fnContext = undefined //函数式组件真实的上下文Vue实例
    this.fnOptions = undefined 
    this.fnScopeId = undefined // 
    this.key = data && data.key // 唯一标识
    this.componentOptions = componentOptions // 包括Ctor钩子函数 propsData 父往子传递的数据, listeners 父绑定的时间, tag 原生标签名字, children 是当前vnode组件包裹的vnode
    this.componentInstance = undefined // 当前vnode组件的实例
    this.parent = undefined // 父节点
    this.raw = false //  是否是原生html
    this.isStatic = false // 是否为静态节点
    this.isRootInsert = true // 是否作为根节点插入
    this.isComment = false // 是否为注释节点
    this.isCloned = false // 是否是克隆的节点
    this.isOnce = false //是否有v-once指令
    this.asyncFactory = asyncFactory // 异步组件的回调函数 如 function(resolve，reject)
    this.asyncMeta = undefined // 异步组件的数据
    this.isAsyncPlaceholder = false // 异步占位vnode
```
现在让我们看看一个组件的vnode结构
```html
  <div class="content">
    <h1>这是标题</h1>
    <div>{{message}}</div>
    <!-- hello-->
    <button @click="add">点击</button>
    <child/>
  </div>
```
```javascript
  {
    tag: "div",
    data: {staticClass:'content'},
    children: [
      {
        tag:'h1',
        children: [{tag:undefined,text:"这是标题"}]
      },
      {
        tag: 'div',
        children: [{tag:undefined,text:"1"}]
      },
      {
        tag: undefined,
        isComment:true,
        text: ' hello '
      },
      {
        tag: 'button',
        data: {on: {click: function(){}}}
        children: [{tag:undefined,text:"点击"}]
      },
      {
        tag: 'vue-component-1-child',
        componentInstance: {},
        componentOptions: {}
      }
    ]
  }
```
可以看出这段结构有描述元素，描述组件，描述注释，描述文本的节点。
### Vnode分类 
Vnode的类型，有`注释节点`,`文本节点`,`元素节点`，`组件节点`
#### 注释节点

```javascript
   export const createEmptyVNode = (text: string = '') => {
        const node = new VNode() // 创建vnode实例
        node.text = text  // 注释内容
        node.isComment = true // 注释vnode标志
        return node
    }
```
```javascript
  // <!-- header -->
   {
       text: "header",
       isComment:true,
       ...
   }
```
#### 文本节点
```javascript
  export function createTextVNode (val: string | number) {
    /**
     * tag undefined  标签
     * data undefined 标签上的数据
     * children undefined 子节点列表
     * text val 文本
    */
   // 标签、数据、children都置为undefined
    return new VNode(undefined, undefined, undefined, String(val))
  }
```
```javascript
   {
       tag: undefined,
       data:undefined,
       children: undefined,
       text: "文本内容"
   }
```
#### 元素节点

```javascript
   new Vnode(tag,data,children);
```
```javascript
  //<div class="content"></div>
  {
     tag: "div",
     text: null,
     data: {staticClass:"content“},
     ...
  }
```
#### 组件节点

```javascript
  // <child/>
   {
     tag: "vue-component-1-child",
     componentInstance: VueComponent {},
     componentOptions: {},
     data:{}
   }
```
组件跟其他节点不太一样，具有`componentInstance`、`componentOptions`属性值，分别存储组件的实例，组件的一些参数，从另外一个角度说明，一个组件是一个vue实例；
#### 函数式节点
```javascript
   let child1 = {
           functional:true,
           props: {
               level: Number,
               content: String
           },
           render(h,{props,data,children}){
             return h(`h${props.level}`,props.content);
           }
       }
    new Vue({
       components:{
         child1,
       },
       template: `<div><child1 :level="1" content="world hello"/></div>`
    })
```
```javascript
   {
     fnContext: Vue {}, // 渲染上下文
     fnOptions: {} // 函数式组件的配置信息,
     tag: 'h1'
   }
```
函数式组件作为性能优化，因为它们的初始化速度比有状态组件快得多，使用场景比较适合简单的组件。

### Vnode作用
vnode是一个类，根据实际不同的类型生成不同的vnode节点；整个组件的真实DOM结构使用vnode来一一对应，当属性变化时，讲新生成的vnode跟旧的vnode进行diff，只对变化的部分进行更新；我们知道频繁对真实DOM进行重排和重绘是最影响性能的。那么提高性能的方式就是减少操作次数，把真实的DOM状态反映在vnode上来，然后一次性比较并修改真实DOM，减少损耗。总之，一切为了减弱频繁的大面积重绘引发的性能问题。

### 更新粒度
vue2对状态的侦查策略采用的中等粒度，即是状态发生变化，是直接通知组件级别进行更新。也就是说，任一一个节点的状态发生变化，都会导致整个组件重新生成vnode节点，会导致性能造成很大的浪费，所以需要缓存vnode，以及新旧vnode的进行diff，找出需要更新的节点。



## patch
`patch`又名打补丁，言外之意，根据新旧的vnode的差异，算出最优，改动最小的解决方案。


### 什么时候会触发patch
当我们订阅的数据发生变化时，依赖收集者`Dep`会通过`notify()`方法来通知观察者`Watcher`，观察者就会调用`update()`来触发注册在观察者上的回调。对于渲染观察者，注册在其身上便是patch方法。

```javascript

 let updateComponent;
  updateComponent = () => {
      vm._update(vm._render(), hydrating)
  }
  new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
```
```javascript
 Vue.prototype._update = function(vnode){
    //...
    vm.__patch__(prevVnode, vnode)
 }
 Vue.prototype.__patch__ = inBrowser ? patch : noop
```
从上述看出，从数据发生变化后最终调用的便是`patch(prevVnode,vnode)`;

### createPatchFunction
听名字可以猜出这个方法是`patch`创建函数，以下是它的结构
```javascript
   export function createPatchFunction (backend) {
      let i, j
      // 钩子汇总
      const cbs = {}
      // modules 定义了一些模块的钩子函数，例如class ，style
      // nodeOps 定义了操作dom的一些方法
      const { modules, nodeOps } = backend

      for (i = 0; i < hooks.length; ++i) {
        cbs[hooks[i]] = []
        for (j = 0; j < modules.length; ++j) {
          if (isDef(modules[j][hooks[i]])) {
            cbs[hooks[i]].push(modules[j][hooks[i]])
          }
        }
      }
     /*
       省略以下函数
      function emptyNodeAt(){} 将真实元素转为空vnode
      function createRmCb(){} 
      function removeNode(){} 移除真实dom
      function isUnknownElement(){} 检测为未知标签
      function createElm(){} 根据vnode创建真实dom
      function createComponent(){} 根据vnode创建组件
      function initComponent(){}
      function reactivateComponent(){}
      function insert(){} 插入真实dom
      function createChildren(){} 循环调用createElm 创建子节点
      function isPatchable(){}
      function invokeCreateHooks(){}


     */

      return function patch(){
        // 省略
      }
  }
```