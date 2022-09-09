const parser = require('./Web2Article')
const axios = require('axios')

const main = async () => {
  const url = 'https://segmentfault.com/a/1190000042442712'
  const html = await axios.get(url)
  const time = []

  for (let i = 0; i < 1000; i++) {
    const start = Date.now()
    await parser(html.data)
    const end = Date.now()
    time.push(end - start)
  }

  const sum = time.reduce((a, b) => a + b, 0)
  const avg = sum / time.length

  console.log(`avg: ${avg}ms`)
}

main()
