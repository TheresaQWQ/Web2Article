# 网页正文提取
使用方法: 
```javascript
const parser = require('./Web2Article.js');
const html = '<html>...</html>';

// 也可以直接输入url
const result = parser(html);
```

- 能适配大部分文章和小说页面
- 提取出来的结果只包含正文部分
- 不能用于提取前端渲染的页面(例如掘金)

## 性能
- 1000次提取，平均耗时 14.656ms (参考 `test.js` 文件)

## ToDo
- [ ] 提取文章标题，发布时间等信息
- [ ] 提取下一页，上一页这一类小说页面的信息
- [ ] 优化大量标签的情况下的性能
- [ ] 优化一下代码质量，后续添加新功能可能会考虑分文件和发布npm包