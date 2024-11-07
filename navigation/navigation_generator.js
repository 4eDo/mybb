console.group("4eDo script navigation_generator ");
console.log("%c~~ Скрипт для генерации навигации по матчасти. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/navigation# ");
console.groupEnd();
const linksElement = document.getElementById("sitemap_4eDo_links");
const LINKS = JSON.parse(linksElement.textContent.trim());

function createTagList(data) {
  const tagMap = {};
  
  data.forEach(item => {
    item.tags.forEach(tag => {
      const tagParts = tag.split(':').map(part => part.trim());
      addToTagMap(tagMap, tagParts, item);
    });
  });
  
  const html = generateHTML(tagMap);
  document.getElementById('sitemap_4eDo').innerHTML = html;
}
function addToTagMap(tagMap, tagParts, item) {
  const tag = tagParts[0];
  
  if (!tagMap[tag]) {
    tagMap[tag] = {
      links: [],
      subTags: {}
    };
  }
  
  if (tagParts.length > 1) {
    const subTag = tagParts[1];
    
    if (!tagMap[tag].subTags[subTag]) {
      tagMap[tag].subTags[subTag] = {
        links: [],
        subTags: {}
      };
    }
    
    addToTagMap(tagMap[tag].subTags[subTag].subTags, tagParts.slice(1), item);
  } else {
    if (!tagMap[tag].links.some(link => link.link === item.link)) {
      tagMap[tag].links.push({
        link: item.link,
        title: item.title
      });
    }
  }
}
function generateHTML(tagMap, isSubTag = false) {
  let html = '';
  
  const sortedTags = Object.keys(tagMap).sort();
  for (const tag of sortedTags) {
    if (!isSubTag) {
      html += `<ul class="tagList">`;
      html += `<li class="tagTitle">${tag}</li>`;
    } else {
      html += `<ul class="tagList subList">`;
      html += `<li class="tagList subTitle">${tag}</li>`;
    }
    
    const sortedLinks = tagMap[tag].links.sort((a, b) => a.title.localeCompare(b.title));
    
    sortedLinks.forEach(linkObj => {
      html += `<li><a class="tagItem" href="${linkObj.link}">${linkObj.title}</a></li>`;
    });
    
    for (const subTag in tagMap[tag].subTags) {
      const nestedHtml = generateHTML(tagMap[tag].subTags[subTag].subTags, true);
      html += nestedHtml;
    }
    
    html += `</ul>`;
  }
  
  return html;
}
createTagList(LINKS);
