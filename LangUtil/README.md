## ts代码须知
目前支持的函数包括
```ts
LangUtil.getMsg(`文本`)  
TipUtil.client(`文本`)
TipUtil.server(`文本`)
```

## code码需要指定模块
### 方式1
文件开头增加特殊标记，类似下面的字符串：
```ts
//@code@强化@
```
程序在搜索文件的时候，先搜索文件中，是否有此独立行数的字符串  
然后提取`强化`两个字，以`强化`作为A列的标题
 
### 方式2
在文件夹结构中，建立特殊命名的配置文件`msg`（使用UTF8编码的文件）  
然后文件中写上 如`强化`之类的文字  
这样和文件同级或者子级的文件，均以`强化`作为A列的标题
