import axios from 'axios'
import { promises as fs } from 'fs';
import * as Web2Article from '../src/Web2Article'

const novel = [
  'https://www.xbiquge.la/56/56523/23595988.html',
  'http://www.biqugse.com/69761/76596355.html'
]

const article = [
  'https://segmentfault.com/a/1190000017511459'
]

const chapter = [
  'https://www.xbiquge.la/56/56523/',
  'http://www.biqugse.com/69761/'
]

const start = async () => {
  console.log(`start test for novel`)
  for (const index in novel) {
    const url = novel[index]
    console.log(`test for ${url}`)
    const html = await axios.get(url)
    const result = await Web2Article.getContent(html.data, {
      novel: true,
      title: true,
    })

    fs.writeFile(`./test/tmp/novel${index}.html`, result.html)
    fs.writeFile(`./test/tmp/novel${index}.json`, JSON.stringify(result, null, 2))
    console.log(`test for ${url} done`)
  }

  for (const index in chapter) {
    const url = chapter[index]

    console.log(`test for ${url}`)
    const html = await axios.get(url)
    const result = await Web2Article.getChapter(html.data)

    fs.writeFile(`./test/tmp/chapter${index}.json`, JSON.stringify(result, null, 2))

    console.log(`test for ${url} done`)
  }

  console.log(`start test for article`)
  for (const index in article) {
    const url = article[index]
    console.log(`test for ${url}`)
    const html = await axios.get(url)
    const result = await Web2Article.getContent(html.data, {
      title: true,
      date: true
    })
    fs.writeFile(`./test/tmp/article${index}.html`, result.html)
    fs.writeFile(`./test/tmp/article${index}.json`, JSON.stringify(result, null, 2))
    console.log(`test for ${url} done`)
  }
}

start()
