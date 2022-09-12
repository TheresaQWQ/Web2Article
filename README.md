# 网页正文提取
使用方法: 
```javascript
const Web2Article = require('Web2Article');
const html = '<html>...</html>';

// 提取内容
const result = Web2Article.getContent(html);

// 提取章节列表
const result = Web2Article.getChapter(html);
```

- 能适配大部分文章和小说页面
- 提取出来的结果只包含正文部分
- 不能用于提取前端渲染的页面(例如掘金)

## 性能
- 1000次提取，平均耗时 14.656ms (参考 `benchmark.js` 文件)

## ToDo
- [x] ~~提取文章标题~~
- [x] ~~提取下一页，上一页这一类小说页面的信息~~
- [ ] 提取发布时间
- [ ] 优化大量标签的情况下的性能
- [ ] 优化一下代码质量，后续添加新功能可能会考虑分文件和发布npm包
