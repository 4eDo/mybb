console.group("4eDo script topic style v1.0");
console.log("%c~~ Скрипт для загрузки стиля в тему. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/topicStyle# ");
console.groupEnd();

jQuery(document).on('custom_tag', function(e) {
    if (e.tag !== 'topicStyle') return;
    $el = e.sender;
  
    const raw = $el.text().trim();
    if (!raw) return;

    const safeCss = raw
        .replace(/<\/style/gi, '')      // нельзя закрыть тег
        .replace(/<!--|-->/g, '')       // нельзя открыть/закрыть HTML-комментарий
        .replace(/@import[^;]*;?/gi, ''); // нельзя @import

    const style = document.createElement('style');
    style.textContent = safeCss;
    $el.appendChild(style);
});
