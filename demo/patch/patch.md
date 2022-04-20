# vue2 patch 过程（一）
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
     data:{
       hook:{
         destroy: function(){},
         init: function(){
           // ...省略
           // 可以看做new Vue();
           return new vnode.componentOptions.Ctor();
         },
         insert: function(){
           //调用mounted 函数
         },
         prepatch: function(){
           // keep-alive update 用的
         }
       }
     }
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
       省略以下一些辅助函数
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
      function setScope(){}
      function addVnodes(){} 循环调用createElm
      function invokeDestroyHook(){}
      function removeVnodes(){} 循环调用removeVnode
      function removeAndInvokeRemoveHook(){} 触发一些销毁钩子
      function updateChildren(){} 更新子节点
      function checkDuplicateKeys(){} 检查一样的key
      function findIdxInOld(){} 在旧的children寻找一样的vnode
      function patchVnode(){} 对比新旧节点
      function invokeInsertHook(){} 触发插入钩子
      function hydrate(){}  服务端渲染用的
      function assertNodeMatch(){} 服务端渲染用的

     */

      return function patch(){
        // 省略
      }
  }
```
首先看看`createPatchFunction`的参数`backend`。`backend.nodeOps`是操作真实DOM的方法，如下
```javascript
 {
  appendChild: ƒ appendChild(node, child)
  createComment: ƒ createComment(text)
  createElement: ƒ createElement$1(tagName, vnode)
  createElementNS: ƒ createElementNS(namespace, tagName)
  createTextNode: ƒ createTextNode(text)
  insertBefore: ƒ insertBefore(parentNode, newNode, referenceNode)
  nextSibling: ƒ nextSibling(node)
  parentNode: ƒ parentNode(node)
  removeChild: ƒ removeChild(node, child)
  setStyleScope: ƒ setStyleScope(node, scopeId)
  setTextContent: ƒ setTextContent(node, text)
  tagName: ƒ tagName(node)
 }
```
`backend.modules`则是完成一些功能块的钩子，分别是对`属性值`，`类`，`事件`，`DOM属性`,`DOM style`,`transition动画`,`ref`，`directives`的操作
```javascript
Array(8)
  0:
  create: ƒ updateAttrs(oldVnode, vnode)
  update: ƒ updateAttrs(oldVnode, vnode)
  [[Prototype]]: Object
  1:
  create: ƒ updateClass(oldVnode, vnode)
  update: ƒ updateClass(oldVnode, vnode)
  [[Prototype]]: Object
  2:
  create: ƒ updateDOMListeners(oldVnode, vnode)
  update: ƒ updateDOMListeners(oldVnode, vnode)
  [[Prototype]]: Object
  3:
  create: ƒ updateDOMProps(oldVnode, vnode)
  update: ƒ updateDOMProps(oldVnode, vnode)
  [[Prototype]]: Object
  4:
  create: ƒ updateStyle(oldVnode, vnode)
  update: ƒ updateStyle(oldVnode, vnode)
  [[Prototype]]: Object
  5:
  activate: ƒ _enter(_, vnode)
  create: ƒ _enter(_, vnode)
  remove: ƒ remove$$1(vnode, rm)
  [[Prototype]]: Object
  6:
  create: ƒ create(_, vnode)
  destroy: ƒ destroy(vnode)
  update: ƒ update(oldVnode, vnode)
  [[Prototype]]: Object
  7:
  create: ƒ updateDirectives(oldVnode, vnode)
  destroy: ƒ unbindDirectives(vnode)
  update: ƒ updateDirectives(oldVnode, vnode)
  [[Prototype]]: Object
  length: 8
```

#### patch主流程
我们操作dom无非就是增，删，改，那其实`patch`过程也是跟这三种情况有关系，主要分为这几种情况处理
- 新节点不存在，旧节点存在，代表要`移除`;
- 新节点存在，旧节点不存在，代表要`新增`;
- 新旧节点存在，旧节点不是真实元素且新旧节点是同个节点，代表要`修改`；
- 新旧节点都存在，旧节点是真实元素，这种情况一般是初始化渲染，旧节点是容器元素的dom`<div id="app"></div>`;

```javascript
 function patch(oldVnode,vnode){
 
     if (isUndef(vnode)) {
      // 没有新vnode，只有旧vnode，移除节点,就会触发destory钩子
      if (isDef(oldVnode)) invokeDestroyHook(oldVnode)
      return
    }
    // 省略...

    if (isUndef(oldVnode)) {
      // 首次渲染组件时会出现这种情况）
      // 旧vnode不存在，新vnode存在，也就是新增了节点
      createElm(vnode, insertedVnodeQueue)
    } else {
      // 新旧节点都存在的情况

      const isRealElement = isDef(oldVnode.nodeType)
      if (!isRealElement && sameVnode(oldVnode, vnode)) {
        // 不是元素节点并且新vnode跟oldNode相等，表示是修改，去做对比
        // patch existing root node
        patchVnode(oldVnode, vnode, insertedVnodeQueue, null, null, removeOnly)
      }  else {
          if (isRealElement) {
            // 创建一个空vnode替代真正的dom节点
            oldVnode = emptyNodeAt(oldVnode)
          }

        // replacing existing element
        // 旧vnode的真正元素节点
        const oldElm = oldVnode.elm
        // 旧vnode的父节点
        const parentElm = nodeOps.parentNode(oldElm)
        // 通过虚拟节点创建真实的元素并插入到它的父节点中
        // create new node
        createElm(
          vnode,
          insertedVnodeQueue,
          // extremely rare edge case: do not insert if old element is in a
          // leaving transition. Only happens when combining transition +
          // keep-alive + HOCs. (#4590)
          oldElm._leaveCb ? null : parentElm,
          nodeOps.nextSibling(oldElm)
        )
        // 省略销毁oldVnode
      }
    }
 }
```


##### createElm

```javascript
   /**
   * 
   * @param {*} vnode 
   * @param {*} insertedVnodeQueue 
   * @param {*} parentElm 父节点
   * @param {*} refElm refElm nextSibling 节点，如果有，插入到父节点之下该节点之前
   * @param {*} nested nested 是否是嵌套创建元素，在 createChildren 里调用 createElm 时，该值为 true
   * @param {*} ownerArray ownerArray 若 VNode 来源于某个 VNode 类型的数组，该参数即为该数组（比如该 VNode 是 vnodeParent 的子节点，ownerArray 即为 vnodeParent.children）
   * @param {*} index  index VNode 在 ownerArray 中的索引
   * @returns 
   */
  function createElm (
    vnode,
    insertedVnodeQueue,
    parentElm,
    refElm,
    nested,
    ownerArray,
    index
  ) {
    if (isDef(vnode.elm) && isDef(ownerArray)) {
      // 大概意思是用作渲染的vnode，现在重写它的elm活导致潜在的错误
      // This vnode was used in a previous render!
      // now it's used as a new node, overwriting its elm would cause
      // potential patch errors down the road when it's used as an insertion
      // reference node. Instead, we clone the node on-demand before creating
      // associated DOM element for it.
      vnode = ownerArray[index] = cloneVNode(vnode)
    }

    vnode.isRootInsert = !nested // for transition enter check
    // 如果vnode是一个组件，则执行init钩子，创建组件实例并挂载，然后为组件执行各模块的create钩子，如果组件被keep-alive包裹，则激活组件
    if (createComponent(vnode, insertedVnodeQueue, parentElm, refElm)) {
      return
    }

    const data = vnode.data
    const children = vnode.children
    const tag = vnode.tag
    if (isDef(tag)) {
      //如果有tag
      if (process.env.NODE_ENV !== 'production') {
        if (data && data.pre) {
          creatingElmInVPre++
        }
        // 省略非法标签显示
      }
     // 创建dom节点
      vnode.elm = vnode.ns
        ? nodeOps.createElementNS(vnode.ns, tag)
        : nodeOps.createElement(tag, vnode)
      setScope(vnode)

      /* istanbul ignore if */
      if (__WEEX__) {
       // 省略...
      } else {
        // 递归创建所有子节点
        createChildren(vnode, children, insertedVnodeQueue)
        if (isDef(data)) {
          invokeCreateHooks(vnode, insertedVnodeQueue)
        }
        // 将节点插入父节点下
        insert(parentElm, vnode.elm, refElm)
      }

    } else if (isTrue(vnode.isComment)) {
      // 注释节点
      vnode.elm = nodeOps.createComment(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    } else {
      // 文本节点
      vnode.elm = nodeOps.createTextNode(vnode.text)
      insert(parentElm, vnode.elm, refElm)
    }
  }
```
从上面可以看出`createElm`的作用，就是在`vnode`转为真实DOM,注入DOM树上来，根据传入的`vnode`类型，如果是`组件vnode`，就执行`createComponent`；如果是常规的节点，继续走下面的流程。
下面分别说明常规的DOM，以及组件的创建流程。

##### 常规DOM创建
常规DOM，可以分为三种类型，`文本`，`注释`，`元素`这种，前面我们说过，元素vnode具有`tag`的值，其他两种是不具备的。
- 没有`tag`
  - `isComment`为真，调用`nodeOps.createComment`创建注释节点插入树中
  - 否则，调用`nodeOps.createTextNode`创建文本节点插入树中
- 有`tag`
  - 先调用`nodeOps.createElement`为vnode创建节点`vnode.elm`,之后调用`createChildren`创建子节点，然后插在`vnode.elm`上来，最后再插在父节点`parentElm`下.

```javascript
function createChildren (vnode, children, insertedVnodeQueue) {
      if (Array.isArray(children)) {
        // 验证children是否使用了重复的key值
        if (process.env.NODE_ENV !== 'production') {
          checkDuplicateKeys(children)
        }
        // 遍历这组节点，创建节点插入父节点，形成dom树
        for (let i = 0; i < children.length; ++i) {
          createElm(children[i], insertedVnodeQueue, vnode.elm, null, true, children, i)
        }
      } else if (isPrimitive(vnode.text)) {
        // 如果text为基本类型，直接添加appendchild
        nodeOps.appendChild(vnode.elm, nodeOps.createTextNode(String(vnode.text)))
      }
    }
```
- children是一个数组，就循环遍历`children`调用`createElm`来生成DOM
- children不是数组且是个文本vnode，就创建一个文本的vnode并且插入父节点上来


##### 组件创建

```javascript
function createComponent (vnode, insertedVnodeQueue, parentElm, refElm) {
    let i = vnode.data
    if (isDef(i)) {
      // 组件实例存在并且被keep-alive包裹
      const isReactivated = isDef(vnode.componentInstance) && i.keepAlive
      if (isDef(i = i.hook) && isDef(i = i.init)) {
        // 调用vnode.data.hook.init，创建组件的实例
        i(vnode, false /* hydrating */)
      }
      if (isDef(vnode.componentInstance)) {
        initComponent(vnode, insertedVnodeQueue)
        insert(parentElm, vnode.elm, refElm)
        if (isTrue(isReactivated)) {
          // 如果是被关keep-alive 包裹
          reactivateComponent(vnode, insertedVnodeQueue, parentElm, refElm)
        }
        return true
      }
    }
  }
```
首先vnode是个`组件vnode`，在创建组件vnode的时候，有`node.data.hook.init`这样的钩子,这个钩子主要是为了创建组件实例

```javascript
var componentVNodeHooks = {
  init: function init (vnode, hydrating) {
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      var mountedNode = vnode; // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode);
    } else {
      // 把实例挂在vnode.componentInstance
      var child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      );
      child.$mount(hydrating ? vnode.elm : undefined, hydrating);
    }
  },
  prepatch(){},
  insert(){},
  destroy(){}
}
```
- 有实例、还未销毁并且没有被keep-alive包裹，执行`prepatch`,以后再讲.
- 否则，创建调用`createComponentInstanceForVnode`把实例挂在vnode.componentInstance上来,并且执行`$mount(undefined)`

```javascript
  function createComponentInstanceForVnode (
  // we know it's MountedComponentVNode but flow doesn't
  vnode,
  // activeInstance in lifecycle state
  parent
) {
  var options = {
    _isComponent: true, // 是否是组件
    _parentVnode: vnode,// 组件vnode
    parent: parent // 父实例
  };
  // 内联末班，vue3 已移除
  // check inline-template render functions
  var inlineTemplate = vnode.data.inlineTemplate;
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render;
    options.staticRenderFns = inlineTemplate.staticRenderFns;
  }
  return new vnode.componentOptions.Ctor(options)
}
```
```javascript
   vnode.componentOptions.Ctor = baseCtor.extend(Ctor)
```
`baseCtor.extend(Ctor)`返回子组件的构造函数,存在`node.componentOptions.Ctor`,
所以会new出一个vue实例来。

```javascript
 child.$mount(hydrating ? vnode.elm : undefined, hydrating)
```
调用`$mounted`方法挂在子组件，然后new一个渲染watcher，触发`updateComponent`，接着`_render`产生vnode，再调用`patch`，又回到梦开始的地方.


`$mounted(undefined)`之后，实际是创建了真正的DOM`vnode.componentInstance.$el`，所以接着调用`initComponent`,把此值赋给`vnode.elm`
```javascript
function initComponent(){
   //省略...
   // 获取挂在元素
    vnode.elm = vnode.componentInstance.$el
    // 省略...
}
```
最后执行`insert(parentElm, vnode.elm, refElm)`把组件的DOM树插入父元素中。此时组件的创建就完成了。


#### invokeDestroyHook
```javascript
   function invokeDestroyHook (vnode) {
    //  执行组件的 destroy 钩子，即执行 $destroy 方法 
    //  执行组件各个模块(ref,directive 等）的 destroy 方法
    //   如果 vnode 还存在子节点，则递归调用 invokeDestroyHook
    let i, j
    const data = vnode.data
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode)
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode)
    }
    // 递归调用child destory的钩子
    if (isDef(i = vnode.children)) {
      for (j = 0; j < vnode.children.length; ++j) {
        invokeDestroyHook(vnode.children[j])
      }
    }
  }
```
`invokeDestroyHook`是触发销毁钩子的工具函数，其中`if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode)` 是触发组件的销毁钩子,`cbs.destroy[i](vnode)`的处理modules上的回调,如果vnode还有children，就继续执行children的销毁

#### invokeCreateHooks
```javascript
  function invokeCreateHooks (vnode, insertedVnodeQueue) {
    // 调用一些插件的声明周期，例如class style等
    for (let i = 0; i < cbs.create.length; ++i) {
      cbs.create[i](emptyNode, vnode)
    }
    i = vnode.data.hook // Reuse variable
    if (isDef(i)) {
      if (isDef(i.create)) i.create(emptyNode, vnode)
      // 收集自定义组件的insert
      if (isDef(i.insert)) insertedVnodeQueue.push(vnode)
    }
  }
```
`invokeCreateHooks`是触发创建函数的工具函数,其中` cbs.create[i](emptyNode, vnode)`是处理modules上create钩子,`insertedVnodeQueue.push(vnode)`是将组件vnode塞进`insertedVnodeQueue`

#### invokeInsertHook
`invokeInsertHook`用来收集组件vnode或者触发组件`vnode.componentInstance.insert`方法，就是`mounted`钩子函数数。 
```javascript
  // patch 结束之后调用
  invokeInsertHook(vnode, insertedVnodeQueue, isInitialPatch)
```
```javascript
  function invokeInsertHook (vnode, queue, initial) {
    // delay insert hooks for component root nodes, invoke them after the
    // element is really inserted
    if (isTrue(initial) && isDef(vnode.parent)) {
      // 能进来代表组件创建的实例，在进行patch
      vnode.parent.data.pendingInsert = queue
    } else {
      // 根组件走这里
      for (let i = 0; i < queue.length; ++i) {
        queue[i].data.hook.insert(queue[i])
      }
    }
```
思考这个问题，有根组件A，组件B，组件C，
A,B,C 分别是子，父，爷的关系。
那么他们mounted执行顺序是怎样的。很明显根据我们的使用经验，执行顺序应该是 C > B > A;
为什么呢，跟`invokeInsertHook`有关系

首先每个组件创建实例之后，都有一个`patch`过程，patch的最小单位是组件。
然后patch过程都会产生一个队列`insertedVnodeQueue`，也就是说每个组件都有一个`insertedVnodeQueue`,是用来收集它的children里面属于组件vnode的`vnode`。

接着我们要知道，A,B,C `patch`过程可以细分为
- A patch start，产生A的insertedVnodeQueue
- B patch start，产生B的insertedVnodeQueue
- C patch start，产生C的insertedVnodeQueue
- C patch end，此时C的insertedVnodeQueue为空，因为是最底层了，没有更低的组件
- B patch end, 此时C已经创建成功了，并且把C的vnode塞进了B的insertedVnodeQueue，所以B的insertedVnodeQueue有C
- A patch end，此时B已经创建成果，并且把B塞给了A，所以A里面有B,C的队列

```javascript
   for (let i = 0; i < queue.length; ++i) {
      queue[i].data.hook.insert(queue[i])
    }
```
此时A就会走上面的流程，执行对应的mounted函数，顺序是C > B > A；

细心的小伙伴会发现，队列没有A，为什么最后会执行A的mounted呢，答案在

```javascript
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
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  if (vm.$vnode == null) {
    // 没有组件vnode，也就是根组件才会进来
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
```
因为整个patch的过程都是同步的，当 `A patch end `之后，因为A是根组件，所以就会走进来,执行`callHook(vm, 'mounted')`;



