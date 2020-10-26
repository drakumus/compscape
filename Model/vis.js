const Nightmare = require('nightmare');
const nightmare = Nightmare({
    show: false // will show browser window
});

const url = 'https://secure.runescape.com/m=forum/sl=0/forums?75,76,331,66006366';
const selector = '.quote';




async function getVis()
{
  let data = await
  nightmare
  .goto(url)
  .wait(selector)
  .evaluate(selector => {
    return {
      data: document.querySelector(selector).innerText
    };
  }, selector)
  .then(extracted => {
    return(extracted.data); //Your extracted data from evaluate
  });
  if(data == null)
  {
    return "Error scraping vis. Probably should ping zoci"
  }
  let regex = /(?<=Combination for )(.|\n)*(?=\nAlts are listed)/
  let matches = data.match(regex);
  if(matches == null)
  {
    return "Error getting vis from scrape. Probably should ping zoci"
  }

  return matches[0];
}


async function test()
{
  let result = await getVis();
  console.log(result);
}

//test();

module.exports = {
  getVis
}
