import bs4
import json
import requests
import time

BASE_URL = 'http://wiki.project1999.com'
CATEGORY_URL = '/index.php?title=Category:{category}'


def get_items_in_category(category):
    item_dict = {}
    next_page = BASE_URL + CATEGORY_URL.format(category=category)
    while next_page:
        print("Getting page: %s" % next_page)
        page = requests.get(next_page)
        soup = bs4.BeautifulSoup(page.text, features="html.parser")
        next_page_tag = soup.find('a', text='next 200')
        if next_page_tag:
            next_page = BASE_URL + next_page_tag.get('href')
        else:
            next_page = None

        found_items = soup.find('div', id='mw-pages').find_all('li')
        for item in found_items:
            item_dict[item.contents[0].text] = item.contents[0].get('href')
        time.sleep(1)
    return item_dict


if __name__ == '__main__':
    items = get_items_in_category("Items")
    with open('items.json', 'w') as items_file:
        items_file.write(json.dumps(items))

    spells = get_items_in_category("Spells")
    with open('spells.json', 'w') as spells_file:
        spells_file.write(json.dumps(spells))
