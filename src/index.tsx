import '@logseq/libs';
import axios from 'axios';
import './utils';
import utils from './utils';

const main = () => {
  console.log('Readwise plugin loaded');

  logseq.provideModel({
    async getBooks() {
      ////////////////////////////////////////////
      ///// STEP 1: CREATE TABLE OF CONTENTS /////
      ////////////////////////////////////////////

      // Get list of books from Readwise
      const booklist = await axios({
        method: 'get',
        url: 'https://readwise.io/api/v2/books/',
        headers: {
          Authorization: `Token udhQHKj5MZ2bsLzKKXd2NT0VE2NTDkHZHS0bXfYCvfAn8KI8re`,
        },
      });

      const latestRetrieved = logseq.settings['latestRetrieved'];

      // Check against retrieved date
      if (
        new Date(booklist.data.results[0].updated) <= new Date(latestRetrieved)
      ) {
        logseq.App.showMsg(`There are no new highlights!`);
        return;
      }

      // Map list of books into logseq compatible array
      const booklistArr = booklist.data.results.map((b) => ({
        content: `[[${b.title}]]
        author:: [[${b.author}]]
        `,
      }));

      // Create Title for Table of Contents
      logseq.App.pushState('page', { name: utils.pageName });

      const currPage = await logseq.Editor.getCurrentPage();
      const pageBlockTree = await logseq.Editor.getCurrentPageBlocksTree();

      // Check if page is populated. If it is, clear page and re-insert the blocks
      if (pageBlockTree.length > 0) {
        utils.clearPage(pageBlockTree);
      }

      const targetBlock = await logseq.Editor.insertBlock(
        currPage.name,
        'Fetching books ...',
        {
          isPageBlock: true,
        }
      );

      await logseq.Editor.insertBatchBlock(targetBlock.uuid, booklistArr, {
        sibling: true,
      });

      await logseq.Editor.updateBlock(
        targetBlock.uuid,
        `retrieved:: ${utils.blockTitle()}`
      );

      ///////////////////////////////////////////////////////////
      ///// STEP 2: GO TO EACH PAGE AND POPULATE HIGHLIGHTS /////
      ///////////////////////////////////////////////////////////

      // Filter out books where there are highlights newer than the last retrieved date
      const latestBookList = booklist.data.results.filter(
        (b) => new Date(b.updated) > new Date(latestRetrieved)
      );

      // Go to each page that has a latest updated date and populate each page
      for (let b of latestBookList) {
        logseq.App.pushState('page', { name: b.title });

        console.log(`Updating ${b.title}`);

        // Get highlights for each book
        const response = await axios({
          method: 'get',
          url: 'https://readwise.io/api/v2/highlights/',
          headers: {
            Authorization: `Token udhQHKj5MZ2bsLzKKXd2NT0VE2NTDkHZHS0bXfYCvfAn8KI8re`,
          },
          params: {
            book_id: b.id,
          },
        });

        //
        const currPage = await logseq.Editor.getCurrentPage();
        const pageBlockTree = await logseq.Editor.getCurrentPageBlocksTree();

        // Check if page is populated. If it is, clear page and re-insert the blocks
        if (pageBlockTree.length > 0) {
          utils.clearPage(pageBlockTree);
        }

        // Insert placeholder for retrieved date
        const headerBlock = await logseq.Editor.insertBlock(
          currPage.name,
          'Fetching highlights...',
          {
            isPageBlock: true,
          }
        );

        // Insert image
        const imageBlock = await logseq.Editor.insertBlock(
          headerBlock.uuid,
          `![book_image](${b.cover_image_url})`,
          { sibling: true }
        );

        // Check for if there are no highlights in that partcular book
        if (response.data.results.length === 0) {
          await logseq.Editor.updateBlock(
            headerBlock.uuid,
            `As of ${utils.blockTitle()}, there are no highlights in this book.`
          );
          continue;
        }

        // Insert highlights block
        const highlightsBlock = await logseq.Editor.insertBlock(
          imageBlock.uuid,
          `[[Readwise Highlights]]`,
          { sibling: true }
        );

        // Get highlights array
        const highlightsArr = response.data.results.map((h) => ({
          content: `${h.text}
            location:: [${h.location}](kindle://book?action=open&asin=${
            b.asin
          }&location=${h.location})
            on:: [[${utils.getDateForPage(new Date(h.highlighted_at))}]]
            `,
        }));

        await logseq.Editor.insertBatchBlock(
          highlightsBlock.uuid,
          highlightsArr,
          {
            sibling: false,
          }
        );

        await logseq.Editor.updateBlock(
          headerBlock.uuid,
          `retrieved:: ${utils.blockTitle()}
          full-title:: [[${b.title}]]
          author:: [[${b.author}]]
          category:: [[${b.category}]]
          source:: [[${b.source}]]
          `
        );
      }

      logseq.App.showMsg('Highlights imported!');

      // logseq.updateSettings({
      //   latestRetrieved: booklist.data.results[0].updated,
      // });
    },
  });

  // Register UI
  logseq.App.registerUIItem('toolbar', {
    key: 'logseq-todoist-plugin',
    template: `
        <a data-on-click="getBooks"
          class="button">
          <i class="ti ti-book"></i>
        </a>
  `,
  });
};

logseq.ready(main).catch(console.error);
