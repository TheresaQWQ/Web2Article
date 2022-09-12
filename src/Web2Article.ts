import html2json from 'html2json'

const getBody = (html: string) => {
  const regex = /<body[^>]*>([\s\S]*)<\/body>/
  const match = regex.exec(html)

  if (match && match.length > 1) return match[1]

  return html
}
// 补全结束标签
const preProcess = (html: string) => {
  const stack: string[] = []

  for (let i = 0; i < html.length; i++) {
    const char = html[i]

    if (char === '<') {
      const fullTag = html.substring(i + 1, html.indexOf('>', i))
      const tag = fullTag.split(' ')[0]
      const end = fullTag[fullTag.length - 1]
      if (end === '/') continue
      if (tag[0] !== '/') {
        stack.push(tag)
      } else {
        stack.pop()
      }
    }
  }

  while (stack.length > 0) {
    const tag = stack.pop() as string
    html += `</${tag}>`
  }

  return html
}

// 过滤掉不需要的标签
const elementFilter = (html: string) => {
  const comment = /<!--[\s\S]*?-->/g
  const script = /<script[\s\S]*?<\/script>/g
  const style = /<style[\s\S]*?<\/style>/g
  const noscript = /<noscript[\s\S]*?<\/noscript>/g
  const iframe = /<iframe[\s\S]*?<\/iframe>/g

  const result = html.replace(comment, '').replace(script, '').replace(style, '').replace(noscript, '').replace(iframe, '')

  return result
}

const getJSON = async (html: string) => {
  const body = getBody(preProcess(html))
  const json = html2json.html2json(elementFilter(body))
  return json
}

const findAll = (root: html2json.Node, filter: (tag: html2json.Node) => boolean, limit: number) => {
  const result: html2json.Node[] = []
  const find = (node: html2json.Node) => {
    if (filter(node)) result.push(node)

    if (result.length >= limit) return

    if (node.child && node.child instanceof Array && node.child.length > 0) {
      node.child.forEach(child => {
        find(child)
      })
    }
  }

  find(root)
  return result
}

const findNearest = (root: html2json.Node, filter: (tag: html2json.Node) => boolean) => {
  const queue: html2json.Node[] = [root]
  let result: html2json.Node | null = null

  while (queue.length > 0) {
    const node = queue.shift() as html2json.Node

    if (filter(node)) result = node

    if (node.child && node.child instanceof Array && node.child.length > 0) {
      node.child.forEach(child => {
        queue.push(child)
      })
    }
  }

  return result
}

const html2text = (html: string) => {
  return html.replace(/<[^>]+>/g, '')
}

interface Web2ArticleOptions {
  // 是否提取标题
  title?: boolean
  // 是否提取发布时间
  date?: boolean
  // 是否启用小说模式(提取下一页和上一页链接)
  novel?: boolean
  // 是否返回纯文本
  text?: boolean
  // 网页链接(用于处理页面中的相对链接)
  url?: string
}

export const getContent = async (inputHTML: string, options: Web2ArticleOptions = {}) => {
  const json = await getJSON(inputHTML)

  const score = (node: html2json.Node) => {
    const tags = [
      'p',
      'div',
      'pre',
      'code',
      'blockquote',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6'
    ]

    const calassNames = [
      'article',
      'content',
      'entry',
      'main'
    ]

    const blockTags = [
      'script',
      'style',
      'noscript',
      'iframe'
    ]

    const blockClassNames = [
      'nav',
      'header',
      'footer',
      'sidebar',
      'ad',
      'comment',
      'share'
    ]

    const tag = node.tag || ''
    const className = node.attr ? node.attr.class : ''
    const id = node.attr ? node.attr.id : ''

    let score = 0

    for (const target of tags) {
      if (tag === target) score += 0.5
    }

    for (const target of blockTags) {
      if (tag === target) score -= 100
    }

    for (const target of calassNames) {
      if (className && className.includes(target)) score += 1.5
      if (id && id.includes(target)) score += 2
    }

    for (const target of blockClassNames) {
      if (className && className.includes(target)) score -= 100
      if (id && id.includes(target)) score -= 100
    }

    return score
  }

  const calculateData: {
    score: number
    node: html2json.Node
    depth: number
    childs: number
  }[] = []

  // 递归遍历json，给每个节点计算可能是正文的分数
  const calculate = (json: html2json.Node, depth = 0) => {
    if (!json) return
    if (json.node !== 'element' && json.node !== 'root') return

    const currentScore = score(json)
    calculateData.push({
      score: currentScore,
      node: json,
      depth: depth,
      // @ts-ignore
      childs: json.child ? json.child.length : 0
    })

      // @ts-ignore
    if (json.child && json.child.length > 0) {
      const children = json.child
      // @ts-ignore
      for (const child of children) {
        const result = calculate(child, depth + 1)
        if (result && result.node) {
          calculateData.push({
            score: result.score + currentScore,
            node: result.node,
            depth: depth,
            // @ts-ignore
            childs: result.node.child ? result.node.child.length : 0
          })
        }
      }
    }

    return {
      score: currentScore,
      node: json
    }
  }

  calculate(json)

  const result1 = calculateData.filter(item => item.childs > 10)

  const result2 = result1.sort((a, b) => {
    const score = b.score - a.score
    const depth = b.depth - a.depth
    const childs = b.childs - a.childs

    return score * 4 + depth * 1.5 + childs * 0.2
  })

  const result = result2[0]

  const target = result.node

  // 计算相对链接
  const urlResolve = (pageUrl: string, url: string) => {
    if (url.startsWith('http')) return url
    if (url.startsWith('//')) return 'http:' + url

    if (url.startsWith('/')) {
      const u = new URL(pageUrl)
      return u.protocol + '//' + u.host + url
    }

    return pageUrl + '/' + url
  }

  // 处理各种标签的链接
  const processLink = (node: html2json.Node) => {
    if (!options.url) return node

    if (node.node === 'element') {
      const src = [
        'img',
        'audio',
        'video'
      ]

      const href = [
        'a'
      ]

      if (src.includes(node.tag || '')) {
        if (node.attr && node.attr.src) {
          node.attr.src = urlResolve(options.url, node.attr.src.toString())
        }
      }

      if (href.includes(node.tag || '')) {
        if (node.attr && node.attr.href) {
          node.attr.href = urlResolve(options.url, node.attr.href.toString())
        }
      }

      // @ts-ignore
      if (node.child && node.child.length > 0) {
        // @ts-ignore
        for (let index = 0; index < node.child.length; index++) {
          // @ts-ignore
          node.child[index] = processLink(node.child[index])
        }
      }
    }

    return node
  }

  const resultJSON = processLink(target)
  const html = html2json.json2html(resultJSON)

  const returns = {
    text: '',
    html: '',
    title: '',
    date: '',
    next: '',
    prev: ''
  }

  returns.html = html

  if (options.text) {
    const text = html2text(html)
    returns.text = text
  }

  if (options.title) {
    const title = findAll(json, tag => tag.tag === 'h1', 1)
    returns.title = title[0] && html2text(html2json.json2html(title[0])).trim() || ''
  }

  if (options.date) {
    const date = findAll(json, tag => {
      if (!tag.attr) return false
      if (!tag.attr.class) return false
      if (!tag.attr.class.includes('date')) return false
      return true
    }, 1)

    returns.date = date[0] && html2text(html2json.json2html(date[0])).trim() || ''
  }

  if (options.novel) {
    const links = findNearest(json, tag => {
      if (!tag.attr) return false
      if (!tag.attr.class) return false
      
      const str = html2json.json2html(tag)
      if (str.includes('下一') && str.includes('上一')) return true

      return false
    })

    const prev_tag = links && findAll(links, tag => tag.tag === 'a' && html2json.json2html(tag).includes('上一'), 1)[0]
    const next_tag = links && findAll(links, tag => tag.tag === 'a' && html2json.json2html(tag).includes('下一'), 1)[0]

    returns.prev = ((prev_tag && prev_tag.attr && prev_tag.attr.href) || '').toString().trim()
    returns.next = ((next_tag && next_tag.attr && next_tag.attr.href) || '').toString().trim()
  }

  return returns
}

/**
 * @description: 获取小说的章节列表
 * @param html 
 */
export const getChapter = async (html: string, limit: number = 2000): Promise<{
  url: string,
  title: string
}[]> => {
  const json = await getJSON(html)

  const links = findAll(json, tag => {
    if (tag.tag !== 'a') return false
    if (!tag.attr) return false
    if (!tag.attr.href) return false

    const str = html2json.json2html(tag)
    const regex = /第(\d+|一|二|三|四|五|六|七|八|九|十|百|千|万)+章/
    return regex.test(str)
  }, limit)

  const result = links.map(link => {
    const url = (link.attr && link.attr.href) || ''
    const text = html2text(html2json.json2html(link))
    return {
      url: url.toString().trim(),
      title: text.trim()
    }
  })

  return result
}
