const FORUMS_WITH_GAMES = {
  "active": [23, 24],
  "done": [19]
};

const DEBUG_MODE = true;
const TOPICS_PER_REQUEST = 100;
const POSTS_PER_REQUEST = 100;

const monthMap = {
  1: ["январь", "янв", "january", "jan"],
  2: ["февраль", "февр", "february", "feb"],
  3: ["март", "мар", "march", "mar"],
  4: ["апрель", "апр", "april", "apr"],
  5: ["май", "may"],
  6: ["июнь", "июн", "june", "jun"],
  7: ["июль", "июл", "july", "jul"],
  8: ["август", "авг", "august", "aug"],
  9: ["сентябрь", "сент", "september", "sep"],
  10: ["октябрь", "окт", "october", "oct"],
  11: ["ноябрь", "ноя", "november", "nov"],
  12: ["декабрь", "дек", "december", "dec"]
};
// Получение месяца по названию
function getMonthNumber(monthStr) {
    for (const monthNumber in monthMap) {
        if (monthMap[monthNumber].includes(monthStr.toLowerCase())) {
            return parseInt(monthNumber);
        }
    }
    return 0;
}
function parseDate(subject) {
    let dateParsed = false;
    let parsedDate = null;

    // 1. Проверка полного формата даты
    const fullDateRegex = /(?:(\d{1,4})\s*[-.\/]\s*(\d{1,2})\s*[-.\/]\s*(\d{1,4})|(\d{1,4})\s*[-.\/]\s*([a-zA-Zа-яА-Я]+)\s*[-.\/]?(\d{1,2})?)/i;
    const fullDateMatch = subject.match(fullDateRegex);
    if (fullDateMatch) {
        let year, month, day;
        if (fullDateMatch[1] && fullDateMatch[2] && fullDateMatch[3]) {
            year = parseInt(fullDateMatch[1]);
            month = parseInt(fullDateMatch[2]);
            day = parseInt(fullDateMatch[3]);
        } else if (fullDateMatch[4] && fullDateMatch[5]) {
            year = parseInt(fullDateMatch[4]);
            month = getMonthNumber(fullDateMatch[5].toLowerCase());
            day = parseInt(fullDateMatch[6]) || 0;
        }
        if (year && month) {
            parsedDate = {y: year, m: month, d: day};
            dateParsed = true;
        }
    }

    // 2. Проверка сокращенных форматов даты (без дня)
    if (!dateParsed) {
        const shortDateRegex = /(\d{1,2})\s*[-.\/]\s*(\d{4})|(\d{4})\s*[-.\/]\s*(\d{1,2})/;
        const shortDateMatch = subject.match(shortDateRegex);
        if (shortDateMatch) {
            let year, month;
            if (shortDateMatch[1] && shortDateMatch[2]) {
                month = parseInt(shortDateMatch[1]);
                year = parseInt(shortDateMatch[2]);
            } else if (shortDateMatch[3] && shortDateMatch[4]) {
                year = parseInt(shortDateMatch[3]);
                month = parseInt(shortDateMatch[4]);
            }
            if (year && month) {
                parsedDate = {y: year, m: month, d: 0};
                dateParsed = true;
            }
        }
    }

    // 3. Проверка с удалением запятых и поиском месяца словом
    if (!dateParsed) {
        const noCommaSubject = subject.replace(/,/g, '');
        const wordMonthRegex = new RegExp(`(${Object.values(monthMap).flat().join('|')})\\s*(\\d{4})`, 'i');
        const wordMonthMatch = noCommaSubject.match(wordMonthRegex);
        if (wordMonthMatch) {
            const monthStr = wordMonthMatch[1];
            const yearStr = wordMonthMatch[2];
            const month = getMonthNumber(monthStr);
            const year = parseInt(yearStr);
            if (year && month) {
                parsedDate = {y: year, m: month, d: 0};
                dateParsed = true;
            }
        }
    }

    // 4. Проверка только года
    if (!dateParsed) {
        const yearOnlyRegex = /(\d{4})/;
        const yearOnlyMatch = subject.match(yearOnlyRegex);
        if (yearOnlyMatch) {
            const year = parseInt(yearOnlyMatch[1]);
            if (year) {
                parsedDate = {y: year, m: 0, d: 0};
                dateParsed = true;
            }
        }
    }

    return parsedDate;
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
    flags: { active: activeFlag, done: !activeFlag, full_date: false },
    addon: {
      display: null,
      date: { y: 0, m: 0, d: 0 },
      is_serial: false,
      serial_first: 0
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
        console.log(`Post ${post.id} in topic ${post.topic_id} contains [nick] tag: ${nickMatch[1].trim()}`);
      }
      processedTopics[topicIndex].users.push(user_data);

      if (post.id === processedTopics[topicIndex].first_post) {
        const addonRegex = /\[chronodisplay\](.*?)\[\/chronodisplay\]/;
        const addonMatch = post.message.match(addonRegex);
        if (addonMatch) {
          processedTopics[topicIndex].addon.display = addonMatch[1];
        }

        const dateRegexAddon = /\[chronodate\]y:\s*(\d+),\s*m:\s*(\d+),\s*d:\s*(\d+)\[\/chronodate\]/;
        const dateMatchAddon = post.message.match(dateRegexAddon);
        if (dateMatchAddon) {
          processedTopics[topicIndex].addon.date = { y: parseInt(dateMatchAddon[1]), m: parseInt(dateMatchAddon[2]), d: parseInt(dateMatchAddon[3]) };
        }

        const serialRegexAddon = /\[chronoserial\](.*?)\[\/chronoserial\]/;
        const serialMatchAddon = post.message.match(serialRegexAddon);
        if (serialMatchAddon) {
          processedTopics[topicIndex].addon.is_serial = true;
          processedTopics[topicIndex].addon.serial_first = parseInt(serialMatchAddon[1]);
        }
      }
    } else {
      console.error("Тема не найдена для поста:", post);
    }
  }

  // date parsing
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
