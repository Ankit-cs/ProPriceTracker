import axios from 'axios';
import * as fs from 'fs';

const url = "https://dl.flipkart.com/dl/pintola-all-natural-peanut-butter-crunchy-unsweetened/p/itm333cafa32ef03?pid=JASFYBHBBMTSJCTB&lid=LSTJASFYBHBBMTSJCTBI5MUEZ&marketplace=FLIPKART&_refId=&_appId=CL";

async function test() {
  const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
  });
  fs.writeFileSync('flipkart.html', response.data);
}
test();
