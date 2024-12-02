const FORUM_WITH_TOPICS = 31;

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
  const url = `/api.php?method=topic.get&forum_id=${FORUM_ID}&fields=id,subject&limit=${TOPICS_PER_REQUEST}`;
  const data = await fetchData(url);
  return data?.response || [];
}

async function getPosts(topicIds) {
  if (!topicIds || topicIds.length === 0) return [];

  let skip = 0;
  let allPosts = [];
  while (true) {
    const url = `/api.php?method=post.get&topic_id=${topicIds.join(',')}&fields=id,username,message,topic_id&limit=${POSTS_PER_REQUEST}&skip=${skip}&sort_by=id&sort_dir=asc`;
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
        tid: topic.id,
        subject: topic.subject,
        fandom: {
            include: [],
            exclude: []
        },
        setting: {
                include: [],
                exclude: []
            },
        sex: "",
        relations: {
                include: [],
                exclude: []
            },
        age: {
            from: 18,
                to: 25
        },
        tags: {
                include: [],
                exclude: []
            },
        author: ""
    }));

    // обработка постов
    for (const post of posts) {
        const topicIndex = processedTopics.findIndex(t => t.id === post.topic_id);
        if (topicIndex !== -1) {
            
            if (post.id === processedTopics[topicIndex].first_post || !correctFirstPost) {
                const addons = parseAddons(post.message);
                if(addons) processedTopics[topicIndex] = {...processedTopics[topicIndex], ...addons};
            }
        } else {
            console.error("Тема не найдена для поста:", post);
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
