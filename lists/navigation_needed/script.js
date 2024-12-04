/* В каких форумах ищем */
const TARGET_FORUMS = {
  "findRole": 31,
  "findPlayer": 32
};

console.group("Для Маяка от 4eDo");
console.log("%c~~ Скрипт для автоматического ведения каталога заявок. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("v0.12");
console.groupEnd();
/**
 * Выгрузка данных по темам
 */
const TOPICS_PER_REQUEST = 100;
const POSTS_PER_REQUEST = 100;
var results;
const addonParsers_bb = {
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
const singleValueAddons = ["catSex", "catAgeFrom", "catAgeTo"];
function parseAddons(message) {
  const addons = {};
  let hasMatch = false;
  for (const addonName in addonParsers_bb) {
    const match = message.match(addonParsers_bb[addonName]);
    let content;
    if (match) {
      content = match[1];
    } else {
      content = extractTextUsingDOMParser(message, addonName);
      break;
    }
    if(content) {
      let addonValue = singleValueAddons.includes(addonName) ? content : content.split(",");
      switch(addonName) {
        case "catFandomIncl": addons["fandom"]["include"] = addonValue; break;
        case "catFandomExcl": addons["fandom"]["exclude"] = addonValue; break;
        case "catSettingIncl": addons["setting"]["include"] = addonValue; break;
        case "catSettingExcl": addons["setting"]["exclude"] = addonValue; break;
        case "catSex": addons["sex"] = addonValue; break;
        case "catRelationsIncl": addons["elations"]["include"] = addonValue; break;
        case "catRelationsExcl": addons["relations"]["exclude"] = addonValue; break;
        case "catAgeFrom": addons["age"]["from"] = addonValue; break;
        case "catAgeTo": addons["age"]["to"] = addonValue; break;
        case "catTagsIncl": addons["tags"]["include"] = addonValue; break;
        case "catTagsExcl": addons["tags"]["exclude"] = addonValue; break;
      }
      hasMatch = true;
      break;
    }
  }
  return hasMatch ? addons : false;
}
function extractTextUsingDOMParser(html, tagName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll(`span.custom_tag_${tagName}`);

  if (elements.length === 0) {
    return null; // Ничего не найдено
  }

  let extractedText = "";
  for (let i = 0; i < elements.length; i++) {
      extractedText += elements[i].textContent.trim();
  }
  return extractedText;
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
    const url = `/api.php?method=post.get&topic_id=${topicIds.join(',')}&fields=id,username,user_id,message,topic_id&limit=${POSTS_PER_REQUEST}&skip=${skip}&sort_by=id&sort_dir=asc`;
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
      processedTopics[topicIndex].author_id = post.user_id;
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



/**
 * Отрисовка страницы
 */
function renderCatalog(data, sortBy) {
  const catalogBox = $("#catalog-box");
  catalogBox.empty();

  const sortedData = {};
  const unspecifiedData = {};

  data.forEach((ticket) => {
    let sortKey;
    let hasValue = false;

    switch (sortBy) {
      case "fandom":
        sortKey =
          ticket.fandom.include && ticket.fandom.include.length > 0
            ? ticket.fandom.include[0]
            : null;
        hasValue = ticket.fandom.include && ticket.fandom.include.length > 0;
        break;
      case "setting":
        sortKey =
          ticket.setting.include && ticket.setting.include.length > 0
            ? ticket.setting.include[0]
            : null;
        hasValue =
          ticket.setting.include && ticket.setting.include.length > 0;
        break;
      case "sex":
        sortKey = ticket.sex || null;
        hasValue = !!ticket.sex;
        break;
      case "relations":
        sortKey =
          ticket.relations.include && ticket.relations.include.length > 0
            ? ticket.relations.include[0]
            : null;
        hasValue =
          ticket.relations.include && ticket.relations.include.length > 0;
        break;
      case "tags":
        sortKey =
          ticket.tags.include && ticket.tags.include.length > 0
            ? ticket.tags.include[0]
            : null;
        hasValue = ticket.tags.include && ticket.tags.include.length > 0;
        break;
    }

    if (sortKey) {
      if (!sortedData[sortKey]) sortedData[sortKey] = [];
      sortedData[sortKey].push(ticket);
    } else if (hasValue) {
      if (!unspecifiedData[sortBy]) unspecifiedData[sortBy] = [];
      unspecifiedData[sortBy].push(ticket);
    } else {
      if (!unspecifiedData[sortBy]) unspecifiedData[sortBy] = [];
      unspecifiedData[sortBy].push(ticket);
    }
  });


  for (const key in sortedData) {
    sortedData[key].sort((a, b) => a.subject.localeCompare(b.subject));
  }

  if (Object.keys(unspecifiedData).length > 0) {
    for (const key in unspecifiedData) {
      unspecifiedData[key].sort((a, b) => a.subject.localeCompare(b.subject));
      sortedData["Не указано"] = unspecifiedData[key]; //Use "Не указано" as key
    }
  }

  const sortedKeys = Object.keys(sortedData)
    .sort((a, b) => a.localeCompare(b))
    .sort((a, b) => (a === "Не указано" ? 1 : -1));

  for (const key of sortedKeys) {
    const list = $('<div class="catalog-list"></div>');
    const title = $('<div class="catalog-title"></div>').text(key);
    const ul = $("<ul></ul>");

    sortedData[key].forEach((ticket) => {
      const li = $(`<li class="ticket ${ticket.marker} ticket-${ticket.tid} ${ticket.author_id == UserID ? 'ticket-your' : ''}"></li>`);
      const a = $(`<details>
        <summary>Заявка "<a class="item-subj" href="/viewtopic.php?id=${ticket.tid}">${ticket.subject}</a>"</summary>
<p><span class="label">Автор заявки:</span> ${ticket.author}</p>
<p><span class="label">Интересуют фандомы:</span> ${ticket.fandom.include ? ticket.fandom.include.join(", ") : "--"
        }</p>
<p><span class="label">НЕ интересуют фандомы:</span> ${ticket.fandom.exclude ? ticket.fandom.exclude.join(", ") : "--"
        }</p>
<p><span class="label">Интересуют сеттинги:</span> ${ticket.setting.include ? ticket.setting.include.join(", ") : "--"
        }</p>
<p><span class="label">НЕ интересуют сеттинги:</span> ${ticket.setting.exclude ? ticket.setting.exclude.join(", ") : "--"
        }</p>
<p><span class="label">Интересует пол:</span> ${ticket.sex}</p>
<p><span class="label">Интересует возраст</span> от ${ticket.age.from != 0 ? ticket.age.from : "?"
        } до ${ticket.age.to != 0 ? ticket.age.to : "?"}</p>
<p class="yes"><span class="label">Интересуют отношения:</span> ${ticket.relations.include ? ticket.relations.include.join(", ") : "--"
        }</p>
<p><span class="label">НЕ интересуют отношения:</span> ${ticket.relations.exclude ? ticket.relations.exclude.join(", ") : "--"
        }</p>
<p><span class="label">Интересуют теги:</span> ${ticket.tags.include ? ticket.tags.include.join(", ") : "--"
        }</p>
<p><span class="label">НЕ интересуют теги:</span> ${ticket.tags.exclude ? ticket.tags.exclude.join(", ") : "--"
        }</p>
</details>`);
      li.append(a);
      ul.append(li);
    });
    list.append(title, ul);
    catalogBox.append(list);
  }
  populateDatalists(data);
}

function populateDatalists(data) {
  const fandomSet = new Set();
  const settingSet = new Set();
  const sexSet = new Set();
  const relationsSet = new Set();
  const tagsSet = new Set();

  data.forEach(ticket => {
    if (ticket.fandom.include) ticket.fandom.include.forEach(f => fandomSet.add(f));
    if (ticket.setting.include) ticket.setting.include.forEach(s => settingSet.add(s));
    if (ticket.sex) sexSet.add(ticket.sex);
    if (ticket.relations.include) ticket.relations.include.forEach(r => relationsSet.add(r));
    if (ticket.tags.include) ticket.tags.include.forEach(t => tagsSet.add(t));
  });

  populateDatalist("fandomList", Array.from(fandomSet));
  populateDatalist("settingList", Array.from(settingSet));
  populateDatalist("sexList", Array.from(sexSet));
  populateDatalist("relationsList", Array.from(relationsSet));
  populateDatalist("tagsList", Array.from(tagsSet));
}

function populateDatalist(listId, items) {
  const datalist = document.getElementById(listId);
  datalist.innerHTML = "";
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    datalist.appendChild(option);
  });
}


function handleTypeChange() {
  switch (document.getElementById('searchInput_type').value) {
    case "all":
      $(".findRole").show();
      $(".findPlayer").show();
      break;
    case "findRole":
      $(".findRole").show();
      $(".findPlayer").hide();
      break;
    case "findPlayer":
      $(".findRole").hide();
      $(".findPlayer").show();
      break;
  };
  $('.catalog-list').each(function () {
    const catalogList = $(this);
    catalogList.show();
    const visibleTickets = catalogList.find('.ticket:visible');
    if (visibleTickets.length === 0) {
      catalogList.hide();
    }
  });
}

function searchInBlocks() {
  const fandom = document.getElementById('searchInput_fandom').value.toLowerCase();
  const setting = document.getElementById('searchInput_setting').value.toLowerCase();
  const sex = document.getElementById('searchInput_sex').value.toLowerCase();
  const relations = document.getElementById('searchInput_relations').value.toLowerCase();
  const tags = document.getElementById('searchInput_tags').value.toLowerCase();

  const detailsElements = document.querySelectorAll('details');

  results.forEach(ticket => {
    const details = document.querySelector(`.ticket-${ticket.tid}`);
    if (!details) return;
    details.classList.remove('success', 'bad', 'notFound');

    const isBad = (value, excludeList) => excludeList.some(excludeItem => value.toLowerCase().includes(excludeItem.toLowerCase()));

    const matchesFandom = !fandom || (ticket.fandom.include.some(item => item.toLowerCase().includes(fandom)) && !isBad(fandom, ticket.fandom.exclude));
    const matchesSetting = !setting || (ticket.setting.include.some(item => item.toLowerCase().includes(setting)) && !isBad(setting, ticket.setting.exclude));
    const matchesSex = !sex || ticket.sex.toLowerCase().includes(sex);
    const matchesRelations = !relations || (ticket.relations.include.some(item => item.toLowerCase().includes(relations)) && !isBad(relations, ticket.relations.exclude));
    const matchesTags = !tags || (ticket.tags.include.some(item => item.toLowerCase().includes(tags)) && !isBad(tags, ticket.tags.exclude));

    if (!fandom && !setting && !sex && !relations && !tags) {
      // Ничего не делаем
    } else if (isBad(fandom, ticket.fandom.exclude) || isBad(setting, ticket.setting.exclude) || isBad(relations, ticket.relations.exclude) || isBad(tags, ticket.tags.exclude)) {
      details.classList.add('bad');
    } else if (matchesFandom && matchesSetting && matchesSex && matchesRelations && matchesTags) {
      details.classList.add('success');
    } else {
      details.classList.add('notFound');
    }
  });
}

function resetFilters() {
  document.getElementById('searchInput_fandom').value = '';
  document.getElementById('searchInput_setting').value = '';
  document.getElementById('searchInput_sex').value = '';
  document.getElementById('searchInput_relations').value = '';
  document.getElementById('searchInput_tags').value = '';

  const detailsElements = document.querySelectorAll('.ticket');
  detailsElements.forEach(details => {
    details.classList.remove('success', 'bad', 'notFound');
  });
}


async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const searchMode = urlParams.get('searchMode') ? urlParams.get('searchMode') : "all";

  const promises = Object.entries(TARGET_FORUMS).map(([marker, forumId]) =>
    processForum(forumId, marker)
  );

  const splitedResults = await Promise.all(promises);
  results = splitedResults.flat();
  console.log(results);

  document.getElementById('searchInput_type').value = searchMode;

  renderCatalog(results, "setting");
  handleTypeChange();
  
  $("body").on("click", ".sort-button", function () {
    $(".sort-button").removeClass("isactive");
    $(this).addClass("isactive");
    const sortBy = $(this).data("sort");
    renderCatalog(results, sortBy);
    handleTypeChange();
    searchInBlocks();
  });

  document.getElementById('searchInput_type').addEventListener('change', handleTypeChange);
}
init();
