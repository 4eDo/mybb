const FORUMS_WITH_GAMES = {
  "active": [23, 24],
  "done": [19]
};

let TOPICS = [];
const DEBUG_MODE = true;
const TOPICS_PER_REQUEST = 100;
const TOPICS_PER_POSTS_REQUEST = 10;
const POSTS_PER_REQUEST = 100;

async function getTopics(forumIds, activeFlag) {
  let skip = 0;
  let limit = TOPICS_PER_REQUEST;
  let allTopics = [];

  while (true) {
    const url = `/api.php?method=topic.get&forum_id=${forumIds.join(',')}&fields=id,subject,first_post&limit=${limit}&skip=${skip}`;
    if (DEBUG_MODE) console.log(`Запрос тем: ${url}`);

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (!data || !data.response || !Array.isArray(data.response)) {
        if (DEBUG_MODE) console.log("Пустой или некорректный ответ от сервера (topics).");
        break;
      }

      const topicsReceived = data.response.length;
      if (DEBUG_MODE) console.log(`Получено тем: ${topicsReceived}`);

      for (const topic of data.response) {
        if (topic.id && topic.subject && topic.first_post) {
          const newTopic = {
            topic_id: topic.id,
            subject: topic.subject,
            users: [],
            posts_count: 0,
            first_post: topic.first_post,
            date: { y: 0, m: 0, d: 0 },
            addon: {
              display: true,
              date: { y: 0, m: 0, d: 0 },
              is_serial: false,
              serial_first: 0
            },
            flags: { active: activeFlag, done: !activeFlag, full_date: false }
          };

          const dateRegex = /(?:(\d{1,7})-(\d{1,2})-(\d{1,2})|(\d{1,7})\/(\d{1,2})\/(\d{1,2})|(\d{1,7})\s+(\d{1,2})\s+(\d{1,2})|(\d{1,2})\.(\d{1,2})\.(\d{4})|(\d{1,2})-(\d{1,2})-(\d{4})|(\d{1,2})\/(\d{1,2})\/(\d{4}))/;
          const match = topic.subject.match(dateRegex);
          if (match) {
            let year, month, day;
            if (match[1]) { year = match[1]; month = match[2]; day = match[3]; }
            else if (match[4]) { year = match[4]; month = match[5]; day = match[6]; }
            else if (match[7]) { year = match[7]; month = match[8]; day = match[9]; }
            else if (match[10]) { day = match[10]; month = match[11]; year = match[12]; }
            else if (match[13]) { day = match[13]; month = match[14]; year = match[15]; }
            else { day = match[16]; month = match[17]; year = match[18]; }
            newTopic.date = { y: parseInt(year), m: parseInt(month), d: parseInt(day) };
            newTopic.flags.full_date = true;
          }
          allTopics.push(newTopic);
        } else {
          console.error("Неполные данные темы:", topic);
        }
      }

      if (topicsReceived < limit) {
        break;
      }
      skip += limit;
    } catch (error) {
      console.error(`Ошибка при выполнении запроса (topics): ${error}`);
      break;
    }
  }
  TOPICS.push(...allTopics);
}


async function getPosts(topicIds) {
  if (!topicIds || topicIds.length === 0) return;

  for (let i = 0; i < topicIds.length; i += TOPICS_PER_POSTS_REQUEST) {
    const batch = topicIds.slice(i, i + TOPICS_PER_POSTS_REQUEST);
    let skip = 0;

    while (true) {
      const url = `/api.php?method=post.get&topic_id=${batch.join(',')}&fields=id,user_id,username,message,topic_id&limit=${POSTS_PER_REQUEST}&skip=${skip}`;
      if (DEBUG_MODE) console.log(`Запрос постов: ${url}`);

      try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data || !data.response || !Array.isArray(data.response)) {
          if (DEBUG_MODE) console.log("Пустой или некорректный ответ от сервера (posts).");
          break;
        }

        const postsReceived = data.response.length;
        if (DEBUG_MODE) console.log(`Получено постов: ${postsReceived}`);

        for (const post of data.response) {
          if (post.user_id && post.username && post.message && post.topic_id) {
            const topicIndex = TOPICS.findIndex(t => t.topic_id === parseInt(post.topic_id, 10));
            if (topicIndex !== -1) {
              TOPICS[topicIndex].posts_count++;
              TOPICS[topicIndex].users.push([post.user_id, post.username]);

              if (post.message.includes("[nick]")) {
                console.log(`Post ${post.id} in topic ${post.topic_id} contains [nick] tag.`);
              }

              if (post.id === TOPICS[topicIndex].first_post) {
                const addonRegex = /\[chronodisplay\](.*?)\[\/chronodisplay\]/;
                const addonMatch = post.message.match(addonRegex);
                if (addonMatch) {
                  TOPICS[topicIndex].addon.display = addonMatch[1];
                }

                const dateRegexAddon = /\[chronodate\]y:\s*(\d+),\s*m:\s*(\d+),\s*d:\s*(\d+)\[\/chronodate\]/;
                const dateMatchAddon = post.message.match(dateRegexAddon);
                if (dateMatchAddon) {
                  TOPICS[topicIndex].addon.date = { y: parseInt(dateMatchAddon[1]), m: parseInt(dateMatchAddon[2]), d: parseInt(dateMatchAddon[3]) };
                }

                const serialRegexAddon = /\[chronoserial\](.*?)\[\/chronoserial\]/;
                const serialMatchAddon = post.message.match(serialRegexAddon);
                if (serialMatchAddon) {
                  TOPICS[topicIndex].addon.is_serial = true;
                  TOPICS[topicIndex].addon.serial_first = parseInt(serialMatchAddon[1]);
                }
              }
            } else {
              console.error("Тема не найдена для поста:", post, TOPICS); // Добавлен вывод массива TOPICS для отладки
            }
          } else {
            console.error("Неполные данные поста:", post);
          }
        }

        if (postsReceived < POSTS_PER_REQUEST) {
          break;
        }
        skip += POSTS_PER_REQUEST;

      } catch (error) {
        console.error(`Ошибка при выполнении запроса (posts): ${error}`);
        break;
      }
    }
  }
}

async function main() {
  const activeTopicsPromise = getTopics(FORUMS_WITH_GAMES.active, true);
  const doneTopicsPromise = getTopics(FORUMS_WITH_GAMES.done, false);

  await Promise.all([activeTopicsPromise, doneTopicsPromise]);

  const topicIds = TOPICS.map(topic => topic.topic_id);
  await getPosts(topicIds);
  console.log(TOPICS);
}

main();
