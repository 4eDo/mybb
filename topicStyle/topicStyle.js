console.group("4eDo script topic style v1.4");
console.log("%c~~ Скрипт для загрузки стиля в тему. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/topicStyle# ");
console.groupEnd();

jQuery(document).on('custom_tag', function(e) {
    if (e.tag !== 'topicStyle') return;

    const $el = e.sender;
    if (!$el || !$el.length) return;

    let raw = $el.html() || '';

    raw = raw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n') 
        .replace(/<[^>]+>/g, '') 
        .replace(/&nbsp;/gi, ' ')
        .replace(/\u00a0/g, ' ') 
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .trim();

    if (!raw) return;

    const safeCss = raw
        .replace(/<\/style/gi, '')       // нельзя закрыть тег раньше времени
        .replace(/<!--|-->/g, '')        // нельзя открыть/закрыть HTML-комментарий
        .replace(/@import[^;]*;?/gi, ''); // нельзя @import (внешние загрузки)

    const style = document.createElement('style');
    style.textContent = safeCss;
    document.head.appendChild(style);

    $el.remove();

    console.log('[topicStyle] применён CSS:', safeCss);
});
