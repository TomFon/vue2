## Vue 源码 之 template 到 AST （二）

在上一次分享中，我们分析了`parseHTML`对字符串 html 的解析，本次分享将再进一步，讲解 vue 如何在`parseHTML`的基础上构建抽象语法树(AST)。
`parse`位于`src/compiler/parser/index.js`,实际该文件所有的内容都在做一件事，就是创建`AST`

### createASTElement

```javascript
  `<div>
     <p>123</p>
   </div>

   {
      attrsList: [{name: 'id', value: 'test', start: 5, end: 14}],
      attrsMap: {id: 'test'},
      children: [
        end: 8,
        start: 5,
        static: true,
        text: "123",
        type:3
      ],
      end: 21,
      parent: undefined,
      plain: true,
      rawAttrsMap: {},
      start: 0,
      static: true,
      staticInFor: false,
      staticProcessed: true,
      staticRoot: true,
      tag: "div"
   }
```

我们首先看看`createASTElement`这个函数,大概可以知道生成的`AST`的结构是怎样的

```javascript
export function createASTElement(
  tag: string,
  attrs: Array<ASTAttr>,
  parent: ASTElement | void
): ASTElement {
  return {
    type: 1, // 节点类型 type=1，为dom节点
    tag, // 节点标签  如 'div'
    attrsList: attrs, // 节点属性，是个数组
    attrsMap: makeAttrsMap(attrs), // 节点映射，是个对象
    rawAttrsMap: {}, // 记录最原始的节点映射，因为attrsMap部分属性可能会被删改，只存在开发环境
    parent, // 父节点
    children: [], // 子节点
  };
}
```

### process\* 系列函数

在`parse`后面定义了一堆的`process*`的函数

```javascript
function processPre(el) {
  /* 省略...*/
}
function processRawAttrs(el) {
  /* 省略...*/
}
export function processElement(element: ASTElement, options: CompilerOptions) {
  /* 省略...*/
}
function processKey(el) {
  /* 省略...*/
}
function processRef(el) {
  /* 省略...*/
}
export function processFor(el: ASTElement) {
  /* 省略...*/
}
export function parseFor(exp: string): ?ForParseResult {
  /* 省略...*/
}
function processIf(el) {
  /* 省略...*/
}
function processIfConditions(el, parent) {
  /* 省略...*/
}
function findPrevElement(children: Array<any>): ASTElement | void {
  /* 省略...*/
}
export function addIfCondition(el: ASTElement, condition: ASTIfCondition) {
  /* 省略...*/
}
function processOnce(el) {
  /* 省略...*/
}
function processSlot(el) {
  /* 省略...*/
}
function processComponent(el) {
  /* 省略...*/
}
function processAttrs(el) {
  /* 省略...*/
}
function checkInFor(el: ASTElement): boolean {
  /* 省略...*/
}
function parseModifiers(name: string): Object | void {
  /* 省略...*/
}
function makeAttrsMap(attrs: Array<Object>): Object {
  /* 省略...*/
}
function isTextTag(el): boolean {
  /* 省略...*/
}
function isForbiddenTag(el): boolean {
  /* 省略...*/
}
function guardIESVGBug(attrs) {
  /* 省略...*/
}
function checkForAliasModel(el, value) {
  /* 省略...*/
}
```

实际上 process\* 系列函数的作用就是对元素描述对象做进一步处理，比如其中一个函数叫做 processPre，这个函数的作用就是用来检测 el 元素是否拥有 v-pre 属性，如果有 v-pre 属性则会在 el 描述对象上添加一个 pre 属性
简单来说，所有的 process\*函数都为给特定的元素添加属性，更充实的描述一个对象。

### parse

再往下定义了整个文件最重要的一个函数，即是`parse`,结构如下

```javascript
export function parse(
  template: string,
  options: CompilerOptions
): ASTElement | void {
  /*
   * 省略...
   * 省略的代码用来初始化一些变量的值，以及创建一些新的变量，其中包括 root 变量，该变量为 parse 函数的返回值，即 AST
   */

  function warnOnce(msg) {
    // 省略...
  }

  function closeElement(element) {
    // 省略...
  }

  parseHTML(template, {
    // 其他选项...
    start(tag, attrs, unary, start, end) {
      // 省略...
    },

    end(tag, start, end) {
      // 省略...
    },

    chars(text: string) {
      // 省略...
    },
    comment(text: string) {
      // 省略...
    },
  });
  return root;
}
```

#### start

`start`所有对`AST`的装饰，添加更多属性跟标记，都源于此。具体看一下这个函数

```javascript
start(tag, attrs, unary, start, end);
// tag 为标签
// attrs [ {name: 'id', value: 'test', start: 5, end: 14}]
// unary 是否是一元
// start 开始标签的开始位置
// end 开始标签的结束位置
```

```javascript
start (tag, attrs, unary, start, end) {
      // check namespace.
      // inherit parent ns if there is one
      // 如果父节点存在，并且父节点有命名空间，则去父节点的命名空间
      // platformGetTagNamespace 函数只会获取 svg 和 math 这两个标签的命名空间，但这两个标签的所有子标签都会继承它们两个的命名空间。对于其他标签则不存在命名空间。
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      if (ns) {
        element.ns = ns
      }
      // 开发环境的话，就记录开始开始标签的开始与结束位置
      if (process.env.NODE_ENV !== 'production') {
        if (options.outputSourceRange) {
          element.start = start
          element.end = end
          element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => {
            cumulated[attr.name] = attr
            return cumulated
          }, {})
        }
        // 非法属性名就抛出错误
        attrs.forEach(attr => {
          if (invalidAttributeRE.test(attr.name)) {
            warn(
              `Invalid dynamic argument expression: attribute names cannot contain ` +
              `spaces, quotes, <, >, / or =.`,
              {
                start: attr.start + attr.name.indexOf(`[`),
                end: attr.start + attr.name.length
              }
            )
          }
        })
      }
      // 如果当前标签是被禁止的，并且在非服务端渲染的情况下
      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.',
          { start: element.start }
        )
      }

      // apply pre-transforms
      // preTransforms 是个数组，数组的每一项就是函数，preTransforms 数组中的那些函数与 process* 系列函数唯一的区别就是平台化的区分即可。
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }
      // 判断当前元素是否在拥有v-pre属性的标签内
      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          // 意味着 后续的所有解析工作都处于 v-pre 环境下，编译器会跳过拥有 v-pre 指令元素以及其子元素的编译过程
          inVPre = true
        }
      }
      // 如果当前的元素是pre标签
      if (platformIsPreTag(element.tag)) {
        // 实际上 inPre 变量与 inVPre 变量的作用相同，都是用来作为一个标识，只不过 inPre 变量标识着当前解析环境是否在 <pre> 标签内
        // <pre> 标签会对其所包含的 html 字符实体进行解码
        // <pre> 标签会保留 html 字符串编写时的空白
        inPre = true
      }
      if (inVPre) {
        // 对于使用了 v-pre 指令的标签及其子代标签，它们的任何属性都将会被作为原始属性处理
        // 经过 processRawAttrs 函数的处理，会在元素的描述对象上添加 element.attrs 属性，它与 element.attrsList 数组结构相同，不同的是 element.attrs 数组中每个对象的 value 值会经过 JSON.stringify 函数处理。
        processRawAttrs(element)
      } else if (!element.processed) {
        // structural directives
        // element.processed 它标识着当前元素是否已经被解析过了, 在元素描述对象应用 preTransforms 数组中的处理函数时被添加的
        // 处理for循环
        processFor(element)
        // 处理if
        processIf(element)
        // 处理once
        processOnce(element)
      }

      if (!root) {
        root = element
        if (process.env.NODE_ENV !== 'production') {
          // 根节点不能是slot template v-for
          checkRootConstraints(root)
        }
      }
      // 不是单标签就入栈，是的话结束这个元素的
      if (!unary) {
        currentParent = element
        stack.push(element)
      } else {
        closeElement(element)
      }
    }
```

#### comment

这个钩子是用来处理注释类型的,把 text 放入对象中，然后 push 到 currentParent.children

```javascript
 comment (text: string, start, end) {
      // adding anything as a sibling to the root node is forbidden
      // comments should still be allowed, but ignored
      if (currentParent) {
        const child: ASTText = {
          type: 3,
          text,
          isComment: true
        }
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          child.start = start
          child.end = end
        }
        currentParent.children.push(child)
      }
    }
```

#### end

```javascript
 end (tag, start, end) {
      const element = stack[stack.length - 1]
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        element.end = end
      }
      closeElement(element)
    },
```
