## Vue 源码 之 template 到 AST （一）

什么是 AST?

```javascript
// <div class="app"><div>123</div></div>
{
    "type": 1,
    "tag": "div",
    "attrsList": [],
    "attrsMap": {
        "class": "app"
    },
    "rawAttrsMap": {},
    "children": [
        {
            "type": 1,
            "tag": "div",
            "attrsList": [],
            "attrsMap": {},
            "rawAttrsMap": {},
            "parent": "[循环引用]",
            "children": [
                {
                    "type": 3,
                    "text": "123",
                    "static": true
                }
            ],
            "plain": true,
            "static": true
        }
    ],
    "plain": false,
    "staticClass": "\"app\"",
    "static": true,
    "staticInFor": false,
    "staticRoot": true,
    "staticProcessed": true
}
```
### parse
模板解析器函数，它返回的抽象语法树
```javascript
  parseHTML(template, {
    warn: warn$2,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    shouldKeepComment: options.comments,
    outputSourceRange: options.outputSourceRange,
    start(tag, attrs, unary) {
            // ...
    },
    end() {
        // ...
    },
    chars(text: string) {
        // ...
    },
    comment(text: string) {
        // ...
    }
}
```


### parseHTML

#### 正则

html-parser 用到的正则

```javascript
// Regular Expressions for parsing tags and attributes
const attribute =
  /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const dynamicArgAttribute =
  /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`;
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;
const startTagOpen = new RegExp(`^<${qnameCapture}`);
const startTagClose = /^\s*(\/?)>/;
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);
const doctype = /^<!DOCTYPE [^>]+>/i;
// #7298: escape - to avoid being passed as HTML comment when inlined in page
const comment = /^<!\--/;
const conditionalComment = /^<!\[/;
```

##### attribute

获取普通属性正则表达式

```javascript
const attribute =
  /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
```

[图解](<https://jex.im/regulex/#!flags=&re=%5E%5Cs*(%5B%5E%5Cs%22'%3C%3E%5C%2F%3D%5D%2B)(%3F%3A%5Cs*(%3D)%5Cs*(%3F%3A%22(%5B%5E%22%5D*)%22%2B%7C'(%5B%5E'%5D*)'%2B%7C(%5B%5E%5Cs%22'%3D%3C%3E%60%5D%2B)))%3F>)

此正则一共有五个捕获分组

1. ([^\s"'<>\/=]+) 匹配非空白字符、非单双引号、非左右尖括号、非斜杠、非等号这些字符至少一个以上
2. (=) 匹配等于号
3. ([^"]\*) 匹配非双引号字符零个或以上
4. ([^']\*) 匹配单双引号字符零个或以上
5. ([^\s"'=<>`]+) 匹配非空白字符、非单双引号、非左右尖括号、非等号，非反引号这些字符至少一个以上

其中第三，四，五分组是不能共存

```javascript
`class="app"`.match(
  attribute
) //["class=\"app\"", "class", "=", "app", undefined, undefined, index: 0, input: "class=\"app\"", groups: undefined]
`class=app`.match(
  attribute
) //["class=app", "class", "=", undefined, undefined, "app", index: 0, input: "class=app", groups: undefined]
`class='app'`.match(
  attribute
) //["class='app'", "class", "=", undefined, "app", undefined, index: 0, input: "class='app'", groups: undefined]
`disabled`.match(attribute);
//["disabled", "disabled", undefined, undefined, undefined, undefined, index: 0, input: "disabled", groups: undefined]
```

##### dynamicArgAttribute

获取动态属性的正则表达式

```javascript
const dynamicArgAttribute =
  /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
```

跟 attribute 很相似，只不过在前面加了`v-[\w-]+:|@|:|#)\[[^=]+?\]`,用来匹配`v-bind:[name]="value"`这种类型

```javascript
`v-bind:[name]="value"`.match(dynamicArgAttribute);
// ["v-bind:[name]=\"value\"", "v-bind:[name]", "=", "value", undefined, undefined, index: 0, input: "v-bind:[name]=\"value\"", groups: undefined]
```

##### ncname

标签的正则

> 一个合法的 XML 标签 可以是\<test\>\<\/test\> 、\<test:a\>\<\/test:a\>

`ncname` 全称是 `An XML name that does not contain a colon (:)`,简而言之就是不包括冒号`:`XML 标签

```javascript
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`;
```

unicodeRegExp.source 是 16 进制的 unicode 字符

##### qnameCapture

`qname` 是由可选项的`前缀`,`冒号`,`名称`组成的，所以 qnameCapture 是捕获`qname`标签的
加斜杠，是因为将会用在`new RegExp()中`

```javascript
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;
```

##### startTagOpen

```javascript
const startTagOpen = new RegExp(`^<${qnameCapture}`);
```

用来匹配`<` 以及后面的 `qnameCapture`（标签名字）

##### startTagClose

```javascript
const startTagClose = /^\s*(\/?)>/;
```

从上面的 startTagOpen 可以看出，没有包括开始标签的闭合部分，即是: `>` 或者 `/>` ，由于标签可能是一元标签，所以开始标签的闭合部分有可能是`/>`,例如`<img/>`

##### endTag

```javascript
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);
```

类似的，`endTag`用来匹配结束标签

##### doctype

```javascript
const doctype = /^<!DOCTYPE [^>]+>/i;
```

匹配`DOCTYPE`标签

##### comment

```javascript
// The /^<!--/ regExp causes bug when injecting js to html #7298
const comment = /^<!\--/;
```

##### conditionalComment

```javascript
const conditionalComment = /^<!\[/;
```

匹配条件注释节点


这个方法是 vue 讲 template 转为 ast 最底层的方法，内容非常多，为了好理解，下面是一些伪代码

```javascript
// no 是一个永远返回false的函数
export function parseHTML(html, options) {
  const stack = []; //存放标签的栈
  const expectHTML = options.expectHTML; // 是否期望和浏览器器保证一致。
  const isUnaryTag = options.isUnaryTag || no; // 是否为一元标签的判断函数
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no; // 是否可以直接进行闭合的标签的判断函数
  let index = 0; // 字节流读入的位置
  let last; // 存储剩余还未parse的html字符串
  let lastTag; // stack栈顶的元素

  // html
  while (html) {
    last = html;
    // 非纯文本标签(script,style,textarea)的内容
    if (!lastTag || !isPlainTextElement(lastTag)) {
      //...
    } else {
      // 纯文本标签的内容
      // ...
    }

    // 说明字符串没有任何改变，此时会把html字符串作为纯文本对待.
    if (html === last) {
      options.chars && options.chars(html);
      if (
        process.env.NODE_ENV !== "production" &&
        !stack.length &&
        options.warn
      ) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, {
          start: index + html.length,
        });
      }
      break;
    }
  }

  parseEndTag();

  function advance(n) {
    //...
  }
  // 解析开始标签
  function parseStartTag() {
    // ...
  }
  // 用来处理parseStartTag()返回的结果
  function handleStartTag(match) {
    // ...
  }
  // 用来处理结束标签
  function parseEndTag(match) {
    // ...
  }
}
```

首先我们看到`parseHTML`函数接受两个参数: `html` 和 `options`，其中 `html`是被 parse 的字符串，而`options`是一些配置项

1. `options.start` 当匹配到开始时执行的回调
2. `options.end` 当匹配到结束时执行的回调
3. `options.comment` 当匹配到注释时执行的回调
4. `options.chars` 但匹配文本时执行的回调

从上面看出，parseHTML 分为三部分，第一部分是`常量`，第二部分`while`循环，第三部分是解析用到的`函数`


先来看第一部分

```javascript
const stack = []; //存放标签的栈
const expectHTML = options.expectHTML; // 是否期望和浏览器器保证一致。
const isUnaryTag = options.isUnaryTag || no; // 是否为一元标签的判断函数
const canBeLeftOpenTag = options.canBeLeftOpenTag || no; // 是否可以直接进行闭合的标签的判断函数
let index = 0; // 字节流读入的位置
let last; // 存储剩余还未parse的html字符串
let lastTag; // stack栈顶的元素
```

`stack`在 while 过程中，匹配到开始标签时，就放里面`push`
`template = <div class="content">213</div>`在 while 过程,stack 变化如下

```javascript
  //1.初始化
  []
  //2.匹配到div开始标签
  [
    {
      attr: [{name: 'class',value: 'content',start: 5,end:20}],
      end: 21,
      start: 0,
      tag: 'div',
      lowerCasedTag: 'div'
    }
  ]
  //3.匹配到"213"，stack无变化如上

  //4.匹配到div结束标签，出栈
  []
```

`expectHTML` 是个布尔值，是否期望和浏览器器的行为保证一致。

`isUnaryTag`,options 的配置函数,用来判断元素是否是一元元素，`no`是一个永远返还`flase`的函数

`canBeLeftOpenTag` options 的配置函数,用来判断元素是否是可省略的非一元函数

```html
<div>
  <p>123</p>
  <p>456</p>
</div>
```

浏览器的默认行为会为开始标签`p`补上结束标签`</p>`，而 vue 也要实现这种行为

```javascript
while (html) {
  last = html;
  // 非纯文本标签(script,style,textarea)的内容
  if (!lastTag || !isPlainTextElement(lastTag)) {
    //...
  } else {
    // 纯文本标签的内容
    // ...
  }

  // 说明字符串没有任何改变，此时会把html字符串作为纯文本对待.
  if (html === last) {
    options.chars && options.chars(html);
    if (
      process.env.NODE_ENV !== "production" &&
      !stack.length &&
      options.warn
    ) {
      options.warn(`Mal-formatted tag at end of template: "${html}"`, {
        start: index + html.length,
      });
    }
    break;
  }
}
```


首先一开始，就把 html 复制给 last

```javascript
last = html;
```

当 while 执行完，发现`html`依然等于`last`，此时把`html`当纯文本处理

接下来重点循环体的主题内容，一开始个 if 判断

```javascript
// Make sure we're not in a plaintext content element like script/style
if (!lastTag || !isPlainTextElement(lastTag)) {
  let textEnd = html.indexOf("<");
  if (textEnd === 0) {
    // textEnd === 0 的情况
  }

  let text, rest, next;
  if (textEnd >= 0) {
    // text >= 0
  }
  if (textEnd < 0) {
    // text < 0
  }
  if (options.chars && text) {
    options.chars(text, index - text.length, index);
  }
}
```

while 围绕着`textEnd`来展开,而`textEnd`是第一次出现`<`的位置

#### while 主体部分

##### textEnd === 0

我们先举个例子，先考虑 `textEnd === 0`的情况,暂且不考虑 `textEnd < 0` 以及 `textEnd >= 0`的情况，例如`<div class="content">123</div>`

```javascript
if (textEnd === 0) {
  // Comment:
  if (comment.test(html)) {
    // 有可能是注释节点
  }

  if (conditionalComment.test(html)) {
    // 有可能是条件注释节点
  }

  // Doctype:
  const doctypeMatch = html.match(doctype);
  if (doctypeMatch) {
    // doctype 节点
  }

  // End tag:
  const endTagMatch = html.match(endTag);
  if (endTagMatch) {
    // 结束标签
  }

  // Start tag:
  const startTagMatch = parseStartTag();
  if (startTagMatch) {
    // 开始标签
  }
}
```

左尖括号开头的字符串，可能是

1. ` <!-- -->` 注释节点
2. `<![ ]>` 条件注释节点
3. `<!DOCTYPE >`
4. `</div>` 结束标签
5. `<div>` 开始标签
6. `<12345` 纯文本

###### parse 注释标签

注释节点，条件注释节点, doctype，比较好理解

```javascript
// Comment:
if (comment.test(html)) {
  const commentEnd = html.indexOf("-->");

  if (commentEnd >= 0) {
    //<!-- hello world -->abc
    //如果需要保留注释节点，就回调
    if (options.shouldKeepComment) {
      options.comment(
        html.substring(4, commentEnd),
        index,
        index + commentEnd + 3
      );
    }
    //指针前进注释总长的长度
    advance(commentEnd + 3);
    continue;
  }
  // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
  if (conditionalComment.test(html)) {
    // <![ hello world]>
    const conditionalEnd = html.indexOf("]>");

    if (conditionalEnd >= 0) {
      // 指正前进注释总长的长度
      advance(conditionalEnd + 2);
      //没有回调，也就是说vue模板不会保留条件注释节点的内容
      continue;
    }
  }

  // Doctype:
  const doctypeMatch = html.match(doctype);
  // 符合doctype正则的，就前进总长
  if (doctypeMatch) {
    advance(doctypeMatch[0].length);
    continue;
  }
}
```

###### parse 开始标签

```javascript
// Start tag:
  const startTagMatch = parseStartTag()
  if (startTagMatch) {
    handleStartTag(startTagMatch)
    // demo: document.write("<textarea cols='10' rows='10'>" + "\nhello\nbabe\n" + "</textarea>");
    if (shouldIgnoreFirstNewline(lastTag, html)) {
      advance(1)
    }
    continue
  }
```

```javascript
const isUnaryTag = makeMap(
  "area,base,br,col,embed,frame,hr,img,input,isindex,keygen," +
    "link,meta,param,source,track,wbr"
);
// Elements that you can, intentionally, leave open
// (and which close themselves)
const canBeLeftOpenTag = makeMap(
  "colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source"
);
// check whether current browser encodes a char inside attribute values
let div;
function getShouldDecode(href: boolean): boolean {
  div = div || document.createElement("div");
  div.innerHTML = href ? `<a href="\n"/>` : `<div a="\n"/>`;
  return div.innerHTML.indexOf("&#10;") > 0;
}

// #3663: IE encodes newlines inside attribute values while other browsers don't
export const shouldDecodeNewlines = inBrowser ? getShouldDecode(false) : false;
// #6828: chrome encodes content in a[href]
export const shouldDecodeNewlinesForHref = inBrowser
  ? getShouldDecode(true)
  : false;
```

parseStartTag 函数

```javascript
function parseStartTag() {
  // 匹配开始标签
  // <div class="content"></div>
  const start = html.match(startTagOpen);
  //  ["<div", "div", index: 0, input: "<div class=\"content\"></div>", groups: undefined]
  if (start) {
    const match = {
      tagName: start[1],
      attrs: [],
      start: index,
    };
    //指针向前前进开始标签长度
    advance(start[0].length);
    // 1.没有匹配到开始标签的结束部分
    // 2.配到到属性
    // 符合上面的两个条件才走下面的循环
    let end, attr;
    while (
      !(end = html.match(startTagClose)) &&
      (attr = html.match(dynamicArgAttribute) || html.match(attribute))
    ) {
      // attr  [" class=\"content\"", "class", "=", "content", undefined, undefined, index: 0, input: " class=\"content\"></div>", groups: undefined]
      attr.start = index;
      advance(attr[0].length);
      attr.end = index;
      match.attrs.push(attr);
    }
    if (end) {
      // end [">", "", index: 0, input: "></div>", groups: undefined]
      //一元标签标记
      match.unarySlash = end[1];
      // 指针前进
      advance(end[0].length);
      match.end = index;
      // {"tagName":"div","attrs":[[" class=\"content\"","class","=","content",null,null]],"start":0,"unarySlash":"","end":21}
      return match;
    }
  }
}
```

handleStartTag 函数

```javascript
function handleStartTag(match) {
  const tagName = match.tagName; // div
  const unarySlash = match.unarySlash; // "" 是否为一元标签

  if (expectHTML) {
    if (lastTag === "p" && isNonPhrasingTag(tagName)) {
      // https://developer.mozilla.org/zh-CN/docs/Web/Guide/HTML/Content_categories
      // p标签的内容模型是流失内容（Flow content）,只允许包含段落式内容（Phrasing content）
      //能进来的，代表tagName不是段落式内容，举个例子 <p><h1></h1></p>
      parseEndTag(lastTag);
      // <p></p><h1></h1></p>
    }
    if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
      // 当前正在解析的标签是一个可以省略结束标签的标签，并且与上一次解析到的开始标签相同
      // 就关闭上一个tagName
      parseEndTag(tagName);
    }
  }
  // 先用默认的方法判断改标签是否为闭合标签，再用unarySlash
  //特殊情况 <my-component/>
  const unary = isUnaryTag(tagName) || !!unarySlash;

  const l = match.attrs.length; //
  const attrs = new Array(l);
  for (let i = 0; i < l; i++) {
    const args = match.attrs[i];
    const value = args[3] || args[4] || args[5] || "";
    const shouldDecodeNewlines =
      tagName === "a" && args[1] === "href"
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines;
    // decodeAttr 作用是对属性值中所包含的html实体进行解码，
    attrs[i] = {
      name: args[1],
      value: decodeAttr(value, shouldDecodeNewlines),
    };
    if (process.env.NODE_ENV !== "production" && options.outputSourceRange) {
      attrs[i].start = args.start + args[0].match(/^\s*/).length;
      attrs[i].end = args.end;
    }
  }

  if (!unary) {
    stack.push({
      tag: tagName,
      lowerCasedTag: tagName.toLowerCase(),
      attrs: attrs,
      start: match.start,
      end: match.end,
    });
    // [{"tag":"div","lowerCasedTag":"div","attrs":[{"name":"class","value":"content","start":5,"end":20}],"start":0,"end":21}]
    lastTag = tagName;
  }
  //触发回调
  if (options.start) {
    options.start(tagName, attrs, unary, match.start, match.end);
  }
}
```

###### parse 结束标签

接下来就是最后`textEnd === 0` 的最后一种情况,匹配结束标签

```javascript
  // End tag:
  const endTagMatch = html.match(endTag)
  if (endTagMatch) {
    // ["</div>", "div", index: 0, input: "</div>", groups: undefined]
    const curIndex = index // 记录当前指针位置
    advance(endTagMatch[0].length) // 指针前置
    parseEndTag(endTagMatch[1], curIndex, index)
    continue
  }
```

有三个作用

1. 检测是否缺少闭合标签
2. 处理`stack`栈中剩余的标签
3. 解析`</br>` 与 `</p>` 标签，与浏览器行为相同

```javascript
function parseEndTag(tagName, start, end) {
  let pos, lowerCasedTagName;
  if (start == null) start = index;
  if (end == null) end = index;

  // Find the closest opened tag of the same type
  if (tagName) {
    // 正常情况下，在栈顶就能找到其对应的开始标签
    lowerCasedTagName = tagName.toLowerCase();
    for (pos = stack.length - 1; pos >= 0; pos--) {
      if (stack[pos].lowerCasedTag === lowerCasedTagName) {
        break;
      }
    }
  } else {
    // If no tag name is provided, clean shop
    pos = 0;
  }

  if (pos >= 0) {
    // Close all the open elements, up the stack
    for (let i = stack.length - 1; i >= pos; i--) {
      if (i > pos || (!tagName && options.warn)) {
        options.warn(`tag <${stack[i].tag}> has no matching end tag.`, {
          start: stack[i].start,
          end: stack[i].end,
        });
      }
      //元素缺少闭合标签，就将其闭合
      if (options.end) {
        options.end(stack[i].tag, start, end);
      }
    }

    // Remove the open elements from the stack
    // 把多余的element去掉
    stack.length = pos;
    lastTag = pos && stack[pos - 1].tag;
  } else if (lowerCasedTagName === "br") {
    // 处理</br>
    if (options.start) {
      options.start(tagName, [], true, start, end);
    }
  } else if (lowerCasedTagName === "p") {
    //处理</p>
    if (options.start) {
      options.start(tagName, [], false, start, end);
    }
    if (options.end) {
      options.end(tagName, start, end);
    }
  }
}
```

#### textEnd >=0 和 < 0 的情况

举个例子`< 1`, `1 </div>`

```javascript
let text, rest, next;
if (textEnd >= 0) {
  // 取 < 之后的字节流
  rest = html.slice(textEnd);
  while (
    !endTag.test(rest) &&
    !startTagOpen.test(rest) &&
    !comment.test(rest) &&
    !conditionalComment.test(rest)
  ) {
    // < in plain text, be forgiving and treat it as text
    // 寻找第二个 < ,若找不到跳出循环
    next = rest.indexOf("<", 1);
    if (next < 0) break;
    textEnd += next;
    rest = html.slice(textEnd);
  }
  text = html.substring(0, textEnd);
}
// 没有<的情况
if (textEnd < 0) {
  text = html;
}

if (text) {
  advance(text.length);
}

if (options.chars && text) {
  options.chars(text, index - text.length, index);
}
```

#### 纯文本标签的处理

```javascript
// aaaaa</textarea>
let endTagLength = 0; // 结束标签的长度
const stackedTag = lastTag.toLowerCase(); //开始标签小写
// 从缓存获取正则表达式
const reStackedTag =
  reCache[stackedTag] ||
  (reCache[stackedTag] = new RegExp(
    "([\\s\\S]*?)(</" + stackedTag + "[^>]*>)",
    "i"
  ));
const rest = html.replace(reStackedTag, function (all, text, endTag) {
  // text 是第一个捕获分组 
  // endTag 弟二个捕获分组
  endTagLength = endTag.length;
  // ?? 搞不懂 ,按道理stackedTag应该是 textarea，style,script,铁定进不去
  if (!isPlainTextElement(stackedTag) && stackedTag !== "noscript") {
    text = text
      .replace(/<!\--([\s\S]*?)-->/g, "$1") // #7298
      .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, "$1");
  }
  if (shouldIgnoreFirstNewline(stackedTag, text)) {
    text = text.slice(1);
  }
  if (options.chars) {
    options.chars(text);
  }
  return "";
});
index += html.length - rest.length;
html = rest;
parseEndTag(stackedTag, index - endTagLength, index);
```
