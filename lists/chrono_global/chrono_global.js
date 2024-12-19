const FORUMS_WITH_GAMES = {
  "active": [23, 24],
  "done": [19]
};
const CURRENT_YEAR = "2010";

const DEBUG_MODE = true;
const TOPICS_PER_REQUEST = 100;
const POSTS_PER_REQUEST = 100;

const monthMap = {
  "январь": 1, "янв": 1, "january": 1, "jan": 1,
  "февраль": 2, "февр": 2, "february": 2, "feb": 2,
  "март": 3, "мар": 3, "march": 3, "mar": 3,
  "апрель": 4, "апр": 4, "april": 4, "apr": 4,
  "май": 5, "may": 5,
  "июнь": 6, "июн": 6, "june": 6, "jun": 6,
  "июль": 7, "июл": 7, "july": 7, "jul": 7,
  "август": 8, "авг": 8, "august": 8, "aug": 8,
  "сентябрь": 9, "сент": 9, "september": 9, "sep": 9,
  "октябрь": 10, "окт": 10, "october": 10, "oct": 10,
  "ноябрь": 11, "ноя": 11, "november": 11, "nov": 11,
  "декабрь": 12, "дек": 12, "december": 12, "dec": 12,
};


function getMonthNumber(monthStr) {
  return monthMap[monthStr.toLowerCase()] || 0;
}


function getFullYear(year) {
    const yearType = typeof year;
  
    if (yearType !== 'number' && yearType !== 'string') {
      return 0;
    }
  
    const yearNum = Number(year);
  
    if (isNaN(yearNum)) {
      return 0;
    }
  
    if (yearNum > 999) {
      return yearNum;
    } else {
      const currentYear = Number(CURRENT_YEAR);
      const currentCentury = Math.floor(currentYear / 100);
      let fullYear;
  
      if (yearNum <= 99) {
        let potentialYear = currentCentury * 100 + yearNum;
  
        if (potentialYear > currentYear) {
          potentialYear -= 100;
        }
  
        fullYear = potentialYear;
      } else {
        const yearStr = String(yearNum).padStart(3, '0');
        const currentYearPrefix = String(currentCentury).padStart(2, '0');
  
        const potentialYear = Number(currentYearPrefix + yearStr.substring(1, 3));
  
        if (potentialYear > currentYear) {
          fullYear = Number(String(currentCentury - 1).padStart(2, '0') + yearStr.substring(1, 3));
        }
         else {
            fullYear = potentialYear;
        }
      }
      return fullYear;
    }
  }

function parseDate(subject) {
  const dateRegex = /(\d{1,2})[.\/ -]?(\d{1,2})[.\/ -]?(\d{2,4})/;
  const yearMonthRegex = /(\d{2,4})[.\/ -]?([a-zA-Zа-яА-Я]+)/i;
    const yearRegex = /(\d{1,})/;
    const complexDateRegex = /(\d{1,2})\.(\d{3,})-(\d{1,2})\.(\d{3,})/i;


    // 1. Проверка с помощью регулярных выражений
    let match = subject.match(dateRegex);
    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        return {y: getFullYear(year), m: month, d: day};
    }

  match = subject.match(yearMonthRegex);
    if (match) {
        const year = parseInt(match[1]);
        const month = getMonthNumber(match[2]);
        if (month) {
            return {y: getFullYear(year), m: month, d: 0};
        }
    }

    // 3. Проверка с удалением запятых и поиском месяца словом
    const noCommaSubject = subject.replace(/,/g, '');
    const wordMonthRegex = new RegExp(`(${Object.keys(monthMap).join('|')})\\s*(\\d{4})`, 'i');
    const wordMonthMatch = noCommaSubject.match(wordMonthRegex);
    if (wordMonthMatch) {
      const monthStr = wordMonthMatch[1];
      const yearStr = wordMonthMatch[2];
      const month = getMonthNumber(monthStr);
      const year = parseInt(yearStr);
      if (year && month) {
        return { y: getFullYear(year), m: month, d: 0 };
      }
    }

  // 4. Проверка только года
  const yearOnlyMatch = subject.match(yearRegex);
    if (yearOnlyMatch) {
        const year = parseInt(yearOnlyMatch[1]);
        return {y: getFullYear(year), m: 0, d: 0};
    }

      // 5. Дополнительная проверка для формата "MM.YYYY-MM.YYYY" - берём только первую дату
  match = subject.match(complexDateRegex);
  if (match) {
      const month = parseInt(match[1]);
      const year = parseInt(match[2]);
      return { y: getFullYear(year), m: month, d: 0 };
  }
  return null; // Если ничего не подошло
}


const addonParsers = {
    display: /\[chronodisplay\](.*?)\[\/chronodisplay\]/,
    date: /\[chronodate\]y:\s*(\d+),\s*m:\s*(\d+),\s*d:\s*(\d+)\[\/chronodate\]/,
    serial: /\[chronoserial\](.*?)\[\/chronoserial\]/,
    quest: /\[chronoquest\](.*?)\[\/chronoquest\]/
};
function parseAddons(message) {
    const addons = {};
    let hasMatch = false;
    for (const addonName in addonParsers) {
        const match = message.match(addonParsers[addonName]);
        if (match) {
            switch (addonName) {
                case 'display':
                    addons[addonName] = match[1];
                    hasMatch = true;
                    break;
                case 'date':
                    addons[addonName] = {
                        y: parseInt(match[1]),
                        m: parseInt(match[2]),
                        d: parseInt(match[3])
                    };
                    hasMatch = true;
                    break;
                case 'serial':
                    addons[addonName] = {
                        is_serial: true,
                        serial_first: parseInt(match[1])
                    };
                    hasMatch = true;
                    break;
                case 'quest':
                    try {
                        addons[addonName] = JSON.parse(match[1].trim());
                    } catch (error) {
                        console.warn("Не удалось разобрать значение [chronoquest]:", match[1].trim());
                        addons[addonName] = match[1].trim(); //храним как строку, если json не разобран
                    }
                
                    hasMatch = true;
                    break;
                default:
                    addons[addonName] = match[1];
                    hasMatch = true;
                    break;
            }
        }
    }
    return hasMatch ? addons : false;
}




async function fetchData(url) {
  if (DEBUG_MODE) console.log(`Fetching: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

async function getTopics(forumIds) {
  const url = `/api.php?method=topic.get&forum_id=${forumIds.join(',')}&fields=id,subject,first_post&limit=${TOPICS_PER_REQUEST}`;
  const data = await fetchData(url);
  return data?.response || [];
}

async function getPosts(topicIds) {
  if (!topicIds || topicIds.length === 0) return [];

  let skip = 0;
  let allPosts = [];
  while (true) {
    const url = `/api.php?method=post.get&topic_id=${topicIds.join(',')}&fields=id,user_id,username,message,topic_id&limit=${POSTS_PER_REQUEST}&skip=${skip}`;
    const data = await fetchData(url);
    if (!data?.response) break;
    allPosts.push(...data.response);
    if (data.response.length < POSTS_PER_REQUEST) break;
    skip += POSTS_PER_REQUEST;
  }
  return allPosts;
}

async function processForum(forumId, activeFlag) {
    const topics = await getTopics([forumId]);
    const topicIds = topics.map(topic => topic.id);
    const posts = await getPosts(topicIds);

    const processedTopics = topics.map(topic => ({
        ...topic,
        posts_count: 0,
        users: [],
        flags: {active: activeFlag, done: !activeFlag, full_date: false},
        addon: {
            display: null,
            date: {y: 0, m: 0, d: 0},
            is_serial: false,
            serial_first: 0,
            quest: false,
            description: ""
        }
    }));

    // обработка постов
    for (const post of posts) {
        const topicIndex = processedTopics.findIndex(t => t.id === post.topic_id);
        if (topicIndex !== -1) {
            processedTopics[topicIndex].posts_count++;

            let user_data = [post.user_id, post.username];
            const nickRegex = /\[nick\](.*?)\[\/nick\]/;
            const nickMatch = post.message.match(nickRegex);
            if (nickMatch) {
                user_data.push(nickMatch[1].trim());
                // console.log(`Post ${post.id} in topic ${post.topic_id} contains [nick] tag: ${nickMatch[1].trim()}`);
            }
            processedTopics[topicIndex].users.push(user_data);
            let correctFirstPost = processedTopics[topicIndex].first_post != 0 && processedTopics[topicIndex].first_post < post.id;
            if(!correctFirstPost) console.log("Bad first post for tid=" + topicIndex);
            if (post.id === processedTopics[topicIndex].first_post || !correctFirstPost) {
                const addons = parseAddons(post.message);
                if(addons) processedTopics[topicIndex].addon = {...processedTopics[topicIndex].addon, ...addons};
                if(!correctFirstPost) processedTopics[topicIndex].first_post = post.id;
                if(!correctFirstPost) console.log("New first post " + post.id + " for tid=" + topicIndex);
                if(!processedTopics[topicIndex].addon.description) processedTopics[topicIndex].description = post.message;
            }
            processedTopics[topicIndex].flags.descr = processedTopics[topicIndex].first_post != 0;
        } else {
            console.error("Тема не найдена для поста:", post);
        }
    }

    // date parsing - вызов отдельной функции
    for (const topic of processedTopics) {
        const parsedDate = parseDate(topic.subject);
        if (parsedDate) {
            topic.date = parsedDate;
            topic.flags.full_date = parsedDate.d !== 0;
        } else {
            console.warn("Не удалось разобрать дату в теме:", topic.subject);
        }
    }

    return processedTopics;
}

async function main() {
  const promises = Object.values(FORUMS_WITH_GAMES).flat().map(forumId =>
    processForum(forumId, FORUMS_WITH_GAMES.active.includes(forumId))
  );

  const results = await Promise.all(promises);
  console.log(results.flat());
}

main();
