const html2json = require('html2json')
const axios = require('axios').default
const userAgents = require('user-agents')

const getHeaders = () => {
  const userAgent = new userAgents()
  return {
    'User-Agent': userAgent.toString(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6,zh-TW;q=0.5'
  }
}

const getHTML = async (url) => {
  try {
    const resp = await axios.get(url, {
      headers: getHeaders()
    })
    return resp.data.toString()
  } catch (error) {
    console.log(error.message)
  }
}

const getBody = (html) => {
  const regex = /<body[^>]*>([\s\S]*)<\/body>/
  const match = regex.exec(html)

  if (match && match.length > 1) {
    return match[1]
  }

  return null
}

// 过滤掉不需要的标签
const elementFilter = (html) => {
  const comment = /<!--[\s\S]*?-->/g
  const script = /<script[\s\S]*?<\/script>/g
  const style = /<style[\s\S]*?<\/style>/g
  const noscript = /<noscript[\s\S]*?<\/noscript>/g
  const iframe = /<iframe[\s\S]*?<\/iframe>/g

  const result = html.replace(comment, '').replace(script, '').replace(style, '').replace(noscript, '').replace(iframe, '')

  return result
}

const getJSON = async input => {
  let html = input

  if (input.startsWith('http')) {
    html = await getHTML(input)
  }

  const body = getBody(html)
  const json = html2json.html2json(elementFilter(body))
  return json
}

const parser = async (url) => {
  const json = await getJSON(url)

  const score = (node) => {
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

  const calculateData = []

  // 递归遍历json，给每个节点计算可能是正文的分数
  const calculate = (json, deepth = 0) => {
    if (!json) return
    if (json.node !== 'element' && json.node !== 'root') return

    const currentScore = score(json)
    calculateData.push({
      score: currentScore,
      node: json,
      deepth: deepth,
      childs: json.child ? json.child.length : 0
    })

    if (json.child && json.child.length > 0) {
      const children = json.child
      for (const child of children) {
        const result = calculate(child, deepth + 1)
        if (result && result.node) {
          calculateData.push({
            score: result.score + currentScore,
            node: result.node,
            deepth: deepth,
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
    const deepth = b.deepth - a.deepth
    const childs = b.childs - a.childs

    return score * 4 + deepth * 1.5 + childs * 0.2
  })

  const result = result2[0]

  const target = result.node

  const urlResolve = (pageUrl, url) => {
    if (url.startsWith('http')) return url
    if (url.startsWith('//')) return 'http:' + url

    if (url.startsWith('/')) {
      const u = new URL(pageUrl)
      return u.protocol + '//' + u.host + url
    }

    return pageUrl + '/' + url
  }

  // 处理各种标签的链接
  const processLink = (node) => {
    if (!url.startsWith('http')) return node

    if (!node) return

    if (node.node === 'element') {
      const src = [
        'img',
        'audio',
        'video'
      ]

      const href = [
        'a'
      ]

      if (src.includes(node.tag)) {
        if (node.attr && node.attr.src) {
          node.attr.src = urlResolve(url, node.attr.src)
        }
      }

      if (href.includes(node.tag)) {
        if (node.attr && node.attr.href) {
          node.attr.href = urlResolve(url, node.attr.href)
        }
      }

      if (node.child && node.child.length > 0) {
        for (let index = 0; index < node.child.length; index++) {
          node.child[index] = processLink(node.child[index])
        }
      }
    }

    return node
  }

  const resultJSON = processLink(target)
  const html = html2json.json2html(resultJSON)

  return html
}

module.exports = parser
