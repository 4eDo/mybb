console.group("4eDo script fill_code_as_form v2.1");
console.log("%c~~ Скрипт для заполнения шаблонов через форму. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/fill_code_as_form# ");
console.groupEnd();

var url = TEMPLATE_SRC;

let needHideNavlinks = typeof NEED_HIDE_NAVLINKS !== 'undefined' ? NEED_HIDE_NAVLINKS : true;

var currentForum = FORUM.topic && FORUM.topic.forum_id ? FORUM.topic.forum_id : new URLSearchParams(window.location.search).get('fid');
var currentTopic = new URLSearchParams(window.location.search).get('id') ? new URLSearchParams(window.location.search).get('id') : new URLSearchParams(window.location.search).get('tid');

var userTemplateList = [];

const overlay = document.querySelector('.tmpl_overlay');
const popup = document.querySelector('.tmpl_popup');
const navlinks = document.getElementById('pun-navlinks');

function showTemplateWindow() {
    overlay.style.display = 'block';
    popup.style.display = 'block';
    if (needHideNavlinks) navlinks.style.display = 'none';
}

function hideTemplateWindow() {
    overlay.style.display = 'none';
    popup.style.display = 'none';
    if (needHideNavlinks) navlinks.style.display = 'block';
}

function ajaxFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url);
        xhr.responseType = 'arraybuffer';

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const decoder = new TextDecoder('windows-1251');
                    const decodedData = decoder.decode(xhr.response);

                    resolve({
                        text: () => decodedData,
                        status: xhr.status,
                        ok: true
                    });
                } catch (e) {
                    reject(new Error(`Ошибка парсинга: ${e.message}`));
                }

            } else {
                reject(new Error(`Ошибка запроса: ${xhr.status} ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error("Ошибка сети"));
        };

        xhr.send();
    });
}

async function fetchAndParseTemplates() {
    if (typeof TEMPLATE_SRC == 'undefined') { console.error("Источник шаблонов не подключен."); return; }
    try {
        let response = await ajaxFetch(url, { responseType: 'text' });

        let htmlText = response.text();

        // console.log("HTML Text:", htmlText);

        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlText, 'text/html');
        let userTemplates = doc.getElementById('userTemplates');
        // console.log("User Templates Block:", userTemplates);
        if (!userTemplates) { console.error("userTemplates не найден."); return; }

        let templates = userTemplates.getElementsByClassName('template');
        let hasTemplates = false;
        let id = 0;

        for (let template of templates) {
            let name = template.querySelector('.tmpl_name').innerText.trim();
            let forums = template.querySelector('.tmpl_forum_ids').innerText.trim().split(" ");
            let topics = template.querySelector('.tmpl_topic_ids').innerText.trim().split(" ");
            let form = JSON.parse(template.querySelector('.tmpl_form').innerHTML.trim());
            let code = template.querySelector('.tmpl_code').innerHTML.trim();
            // console.log("Template:", { name, forums, topics, form, code });

            if (
                (forums.includes("all") || forums.includes(currentForum))
                || (topics.includes("all") || topics.includes(currentTopic))
            ) {
                let templateObj = {
                    id: id,
                    name: name,
                    forums: forums,
                    topics: topics,
                    form: form,
                    code: code
                };
                hasTemplates = true;
                userTemplateList.push(templateObj);
                id++;
            }
        }
        if (hasTemplates) { document.getElementById('templateBtn').style.display = 'inline-block'; }
        populateTemplateList();
    } catch (error) { console.error('Ошибка при получении или обработке данных:', error); }
}

function populateTemplateList() {
    let templatesList = document.getElementById('templatesList');

    for (let template of userTemplateList) {
        let templateDiv = document.createElement('div');
        templateDiv.className = 'tmpl_template';
        templateDiv.setAttribute('onclick', `drawForm(${template.id})`);
        templateDiv.innerText = template.name;
        templatesList.appendChild(templateDiv);
    }
}

function drawForm(id) {
    let targetTmpl = userTemplateList.find(template => template.id === id);

    if (!targetTmpl) {
        console.error(`Template with id ${id} not found.`);
        return;
    }

    console.log("Target Template:", targetTmpl);
    showTargetForm();

    let targetForm = document.getElementById('targetForm');
    targetForm.innerHTML = `<div id="templateFormName">${targetTmpl.name}</div>`;
    let table = document.createElement('table');

    targetTmpl.form.forEach(field => {
		renderFormField(field, table);
    });

    table.addEventListener('change', function(event) {
        if (event.target.tagName === 'SELECT') {
            const selectElement = event.target;
            const fieldTmpl = selectElement.id.replace('field_', '');
            const field = targetTmpl.form.find(f => f.tmpl === fieldTmpl);

            if (field && field.switch && Array.isArray(field.switch)) {
                handleSwitchFields(field, table, selectElement);
            }
        }
    });

    targetForm.appendChild(table);

    let button = document.createElement('div');
    button.id = 'tmpl_get-code-button';
    button.innerText = 'Получить код';
    button.setAttribute('onclick', `fillCode(${id})`);

    targetForm.appendChild(button);
}

function renderFormField(field, table, parentTmpl = null) {
    let row = document.createElement('tr');
    let labelCell = document.createElement('td');
    let label = document.createElement('label');
    label.innerText = field.name;
    let labelDescr = document.createElement('div');
    labelDescr.innerText = field.info
        .replaceAll("{{LINK_TEMPLATE}}", `<a href='адрес_ссылки'>текст_ссылки</a>`)
        .replaceAll("<br>", `\n\n`);
    labelCell.appendChild(label);
    labelCell.appendChild(labelDescr);

    let inputCell = document.createElement('td');
    let inputElement;

    if (field.type === 'text') {
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        if (field.default) {
            inputElement.value = field.default;
        }
    } else if (field.type === 'textarea') {
        inputElement = document.createElement('textarea');
        if (field.default) {
            inputElement.innerText = field.default;
        }
    } else if (field.type === 'number') {
        inputElement = document.createElement('input');
        inputElement.type = 'number';
        if (field.default) {
            inputElement.value = field.default;
        }
    } else if (field.type === 'select') {
        inputElement = document.createElement('select');

        if (field.addEmptyOpt) {
            let option = document.createElement('option');
            option.value = "none";
            option.innerText = field.addEmptyOpt;
            inputElement.appendChild(option);
        }

        if (field.optList) {
            field.optList.forEach(opt => {
                let option = document.createElement('option');
                option.value = opt;
                option.innerText = opt;
                inputElement.appendChild(option);
            });
        }

        if (field.optValAndNameList) {
            field.optValAndNameList.forEach(opt => {
                let option = document.createElement('option');
                option.value = opt.val;
                option.innerText = opt.name;
                inputElement.appendChild(option);
            });
        }

    }

    if (field.textTransform) {
        inputElement.setAttribute('data-textTransform', field.textTransform);
    }

    if (field.valIfEmpty) {
        inputElement.setAttribute('data-valIfEmpty', field.valIfEmpty);
    }

    inputElement.id = `field_${field.tmpl}`;
    inputElement.setAttribute('style', typeof COLOR_INPUT_TEXT_fcaf !== 'undefined' ? COLOR_INPUT_TEXT_fcaf : "color: #000000 !important");
    inputCell.appendChild(inputElement);

    row.appendChild(labelCell);
    row.appendChild(inputCell);

    table.appendChild(row);

    // Handle switch cases (including nested selects)
    if (field.type === 'select' && field.switch && Array.isArray(field.switch)) {
        inputElement.addEventListener('change', function(event) {
            handleSwitchFields(field, table, event.target);
        });
    }
}

function handleSwitchFields(field, table, selectElement) {
    const selectedValue = selectElement.value;
    const switchClass = `switch-${field.tmpl}`;

    let existingSwitchRows = table.querySelectorAll(`.${switchClass}`);
    existingSwitchRows.forEach(row => row.remove());

    if (field.switch && Array.isArray(field.switch)) {
        let switchCase = field.switch.find(caseItem => String(caseItem.targetVal) === selectedValue);
        if (switchCase) {
            let newRow = document.createElement('tr');
            newRow.classList.add(switchClass);
            let newCell = document.createElement('td');
            newCell.colSpan = 2;

            let tempTable = document.createElement('table');
            renderFormField(switchCase, tempTable); // Render the switch case content

            newCell.appendChild(tempTable.querySelector('tr'));
            newRow.appendChild(newCell);
            table.appendChild(newRow);

            if (switchCase.type === 'select' && switchCase.switch && Array.isArray(switchCase.switch)) {
              const nestedSelect = tempTable.querySelector('select');
              if (nestedSelect) {
                  nestedSelect.addEventListener('change', function(event) {
                      handleSwitchFields(switchCase, tempTable, event.target);
                  });
              }
            }
        }
    } else {
        console.warn("field.switch is not a valid array", field.switch);
    }
}

function fillCode(id) {
    let selectedTemplate = userTemplateList.find(template => template.id == id);
    if (!selectedTemplate) { console.error('Шаблон не найден.'); return; }
    let code = selectedTemplate.code;

    let allTmpls = new Set();
    selectedTemplate.form.forEach(field => {
        allTmpls.add(field.tmpl);
        if (field.switch) {
            field.switch.forEach(switchCase => {
                allTmpls.add(switchCase.tmpl);
            });
        }
    });

    allTmpls.forEach(tmpl => {
        let placeholder = `{{${tmpl}}}`;
        let element = document.getElementById(`field_${tmpl}`);
        let inputValue = element ? element.value : null;
        let field = selectedTemplate.form.find(f => f.tmpl === tmpl) ||
            (selectedTemplate.form.find(f => f.switch?.find(s => s.tmpl === tmpl))?.switch?.find(s => s.tmpl === tmpl));

        if (!element) {
          let valIfEmpty = field?.valIfEmpty;
          if (valIfEmpty) {
            inputValue = valIfEmpty === "none" ? "" : valIfEmpty;
            code = code.replaceAll(placeholder, inputValue);
          }
        } else if (inputValue) {
            if (element.getAttribute("data-textTransform")) {
                switch (element.getAttribute("data-textTransform")) {
                    case "lowercase": inputValue = inputValue.toLowerCase(); break;
                    case "uppercase": inputValue = inputValue.toUpperCase(); break;
                }
            }
            let before = field?.wrapper?.before || '';
            let after = field?.wrapper?.after || '';
            inputValue = before + inputValue + after;

            code = code.replaceAll(placeholder, inputValue);
        } else {
            let valIfEmpty = element ? element.getAttribute("data-valIfEmpty") : null;
            if (valIfEmpty) {
                inputValue = valIfEmpty === "none" ? "" : valIfEmpty;
                code = code.replaceAll(placeholder, inputValue);
            }
        }
    });

    code = code.replaceAll("{{CURRENT_USER_ID}}", UserID);
    code = code.replaceAll("{{CURRENT_TOPIC_SRC}}", window.location);

    console.log("Сгенерированный код:", code);
    insert(code);
    hideTemplateWindow();
}

function showTargetForm() {
    document.getElementById('templatesList').style.display = 'none';
    document.getElementById('targetForm').style.display = 'flex';
    document.getElementById('tmpl_back-button').style.display = 'flex';
}
function showTemplatesList() {
    document.getElementById('templatesList').style.display = 'flex';
    document.getElementById('targetForm').style.display = 'none';
    document.getElementById('tmpl_back-button').style.display = 'none';
}

fetchAndParseTemplates();
