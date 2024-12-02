const TARGET_FORUMS = {
  "findRole": 31,
  "findPlayer": 32
};

const TOPICS_PER_REQUEST = 100;
const POSTS_PER_REQUEST = 100;

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

async function fetchData(url) {
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
    const url = `/api.php?method=post.get&topic_id=${topicIds.join(',')}&fields=id,username,message,topic_id&limit=${POSTS_PER_REQUEST}&skip=${skip}&sort_by=id&sort_dir=asc`;
    const data = await fetchData(url);
    if (!data?.response) break;
    allPosts.push(...data.response);
    if (data.response.length < POSTS_PER_REQUEST) break;
    skip += POSTS_PER_REQUEST;
  }
  return allPosts;
}

async function processForum(forumId, marker) {
    const topics = await getTopics([forumId]);
    const topicIds = topics.map(topic => topic.id);
    const posts = await getPosts(topicIds);

    const processedTopics = topics.map(topic => ({
        tid: topic.id,
        first_post: topic.first_post ? topic.first_post : 0,
        subject: topic.subject,
        marker: marker,
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
            from: 0,
            to: 0
        },
        tags: {
            include: [],
            exclude: []
        },
        author: ""
    }));

    const topicIndexMap = Object.fromEntries(processedTopics.map((topic, index) => [topic.tid, index]));

    for (const post of posts) {
        const topicIndex = topicIndexMap[post.topic_id];
        if (topicIndex !== undefined) {
            processedTopics[topicIndex].author = post.username;
            const correctFirstPost = processedTopics[topicIndex].first_post != 0 && processedTopics[topicIndex].first_post < post.id;
            if (post.id === processedTopics[topicIndex].first_post || !correctFirstPost) {
                const addons = parseAddons(post.message);
                if (addons) {
                    processedTopics[topicIndex] = { ...processedTopics[topicIndex], ...addons };
                }
                if (!correctFirstPost) {
                    processedTopics[topicIndex].first_post = post.id;
                }
            }
        } else {
            console.error("Тема не найдена для поста:", post);
        }
    }

    return processedTopics;
}

async function main() {
  const promises = Object.entries(TARGET_FORUMS).map(([marker, forumId]) =>
    processForum(forumId, marker)
  );

  const splitedResults = await Promise.all(promises);
  const results = splitedResults.flat();
  console.log(results);
}

main();
