const FORUM_ID = 31;

const TOPICS_PER_REQUEST = 100;
const POSTS_PER_REQUEST = 1;

const addonParsers = {
    catFandomIncl: /\[catFandomIncl\](.*?)\[\/catFandomIncl\]/,
    catFandomExcl: /\[catFandomExcl\](.*?)\[\/catFandomExcl\]/,
    catSettingIncl: /\[catSettingIncl\](.*?)\[\/catSettingIncl\]/,
    catSettingExcl: /\[catSettingExcl\](.*?)\[\/catSettingExcl\]/,
    catSex: /\[catSex\](.*?)\[\/catSex\]/,
    catRelationsIncl: /\[catRelationsIncl\](.*?)\[\/catRelationsIncl\]/,
    catRelationsExcl: /\[catRelationsExcl\](.*?)\[\/catRelationsExcl\]/,
    catAgeFrom: /\[catAgeFrom\](.*?)\[\/catAgeFrom\]/,
    catAgeTo: /\[catAgeTo\](.*?)\[\/catAgeTo\]/,
    catTagsIncl: /\[catTagsIncl\](.*?)\[\/catTagsIncl\]/,
    catTagsExcl: /\[catTagsExcl\](.*?)\[\/catTagsExcl\]/
};
function parseAddons(message) {
    const addons = {};
    let hasMatch = false;
    for (const addonName in addonParsers) {
        const match = message.match(addonParsers[addonName]);
        if (match) {
            addons[addonName] = match[1];
            hasMatch = true;
            break;
        }
    }
    return hasMatch ? addons : false;
}

function fetchData(url) {
  if (DEBUG_MODE) console.log(`Fetching: ${url}`);

  return new Promise((resolve, reject) => {
    $.ajax({
      url: url,
      method: 'GET',
      dataType: 'json',
      success: function(data) {
        resolve(data);
      },
      error: function(jqXHR, textStatus, errorThrown) {
        const errorText = jqXHR.responseText || 'Unknown error';
        console.error(`Error fetching ${url}: HTTP status: ${jqXHR.status} - ${errorText}`);
        reject(new Error(`HTTP error! status: ${jqXHR.status} - ${errorText}`));
      }
    });
  });
}

async function getTopics(forumIds) {
  const url = `/api.php?method=topic.get&forum_id=${FORUM_ID}&fields=id,subject,first_post&limit=${TOPICS_PER_REQUEST}`;
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
