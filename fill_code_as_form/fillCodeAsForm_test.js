console.group("4eDo script fill_code_as_form v2.0.37");
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
        templateDiv.setAttribute('tabindex', '0');
        templateDiv.setAttribute('role', 'button');
        templatesList.appendChild(templateDiv);
    }
}

function drawForm(id) {
    let targetTmpl = userTemplateList.find(template => template.id === id);

    if (!targetTmpl) {
        console.error(`Template with id ${id} not found.`);
        return;
    }

    // console.log("Target Template:", targetTmpl);
    showTargetForm();

    let targetForm = document.getElementById('targetForm');
    targetForm.innerHTML = `<div id="templateFormName">${targetTmpl.name}</div>`;
    let table = document.createElement('table');

    let formHTML = generateFormHTML(targetTmpl.form);

    table.innerHTML = formHTML;

    targetForm.appendChild(table);

    table.querySelectorAll('select').forEach(selectElement => {
        const fieldTmpl = selectElement.id.replace('field_', '');
        selectElement.addEventListener('change', () => {
            handleSwitchFields(selectElement, fieldTmpl);
        });
        handleSwitchFields(selectElement, fieldTmpl);
    });

    let button = document.createElement('div');
    button.id = 'tmpl_get-code-button';
    button.innerText = 'Получить код';
	button.setAttribute('tabindex', '0');
	button.setAttribute('role', 'button');
    button.setAttribute('onclick', `fillCode(${id})`);
    targetForm.appendChild(button);
}

function renderFormField(field) {
    let inputElement;

    if (field.type === 'text') {
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        if (field.default && !field.parentTmpl) {
            inputElement.value = field.default;
        }
    } else if (field.type === 'textarea') {
        inputElement = document.createElement('textarea');
        if (field.default && !field.parentTmpl) {
            inputElement.innerText = field.default;
        }
    } else if (field.type === 'number') {
        inputElement = document.createElement('input');
        inputElement.type = 'number';
        if (field.default && !field.parentTmpl) {
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

    if (field.default) {
        inputElement.setAttribute('data-default', field.default);
    }
	
    inputElement.id = `field_${field.tmpl}`;
    inputElement.setAttribute('style', typeof COLOR_INPUT_TEXT_fcaf !== 'undefined' ? COLOR_INPUT_TEXT_fcaf : "color: #000000 !important");

    return {
        element: inputElement,
        field: field
    };
}

function generateFormHTML(form) {
    let html = '';

    form.forEach(field => {
        let { element: inputElement, field: currentField } = renderFormField(field);

        let isSwitchCase = field?.parentTmpl || false; 
        let hidden = isSwitchCase ? 'hidden' : '';
        let targetVal = field.targetVal || '';
        let parentTmpl = field.parentTmpl || '';

        html += `
            <tr data-parent-tmpl="${parentTmpl}" ${hidden} data-target-val="${targetVal}">
                <td>
                    <label>${field.name}</label>
                    <div>${field.info.replaceAll("{{LINK_TEMPLATE}}", `<code>&lt;a href='адрес_ссылки'&gt;текст_ссылки&lt;/a&gt;</code>`).replaceAll("<br>", `\n\n`)}</div>
                </td>
                <td>${inputElement ? inputElement.outerHTML : ''}</td>
            </tr>
        `;
    });
    return html;
}

function handleSwitchFields(selectElement, parentTmpl) {
    const selectedValue = selectElement.value;

    hideAllChildren(parentTmpl);

    const childRowsToShow = document.querySelectorAll(`tr[data-parent-tmpl="${parentTmpl}"][data-target-val="${selectedValue}"]`);
    childRowsToShow.forEach(row => {
        row.hidden = false;
        const inputs = row.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            setDefaultValue(input);
        });
    });
}

function setDefaultValue(input) {
    const defaultValue = input.dataset.default;
    if (defaultValue) {
        if (input.type === 'select-one') {
            for (let i = 0; i < input.options.length; i++) {
                if (input.options[i].value === defaultValue) {
                    input.selectedIndex = i;
                    break;
                }
            }
        } else {
            input.value = defaultValue;
        }
    }
}

function hideAllChildren(parentTmpl) {
    const childRows = document.querySelectorAll(`tr[data-parent-tmpl="${parentTmpl}"]`);
    childRows.forEach(row => {
        row.hidden = true;
        const inputs = row.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            resetInput(input);
        });

        hideAllChildren(row.querySelector('select')?.id.replace('field_', ''));
    });
}

function resetInput(input) {
    if (input.type === 'select-one') {
        input.selectedIndex = 0;
    } else {
        input.value = '';
    }
}

function fillCode(id) {
    const selectedTemplate = userTemplateList.find(template => template.id === id);
    if (!selectedTemplate) {
        console.error('Шаблон не найден.');
        return;
    }

    let code = selectedTemplate.code;

    for (const field of selectedTemplate.form) {
        const placeholder = `{{${field.tmpl}}}`;
        const element = document.getElementById(`field_${field.tmpl}`);
        let inputValue = '';

        if (element) {
            inputValue = element.value;
            if (!inputValue && !field.valIfEmpty) {
                continue; // Skip if input is empty and no valIfEmpty is defined
            }
        }

        if (field.valIfEmpty === "none") {
            inputValue = "";
        } else if (field.valIfEmpty) {
            inputValue = field.valIfEmpty;
        }

        if (element && element.getAttribute("data-textTransform")) {
            const transform = element.getAttribute("data-textTransform");
            inputValue = transform === 'lowercase' ? inputValue.toLowerCase() : transform === 'uppercase' ? inputValue.toUpperCase() : inputValue;
        }

        const before = field?.wrapperBefore || '';
        const after = field?.wrapperAfter || '';
        inputValue = before + inputValue + after;

        code = code.replaceAll(placeholder, inputValue);
    }

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
