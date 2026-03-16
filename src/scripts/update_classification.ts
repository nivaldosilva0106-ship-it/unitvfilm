import { updateContent, getAllContents } from '@/lib/firebase';

const addClassification = async () => {
    const contents = await getAllContents();
    if (contents.length > 0) {
        const item = contents[0];
        console.log(`Updating ${item.title} with classification 16`);
        await updateContent(item.id, { classification: '16' });
        console.log('Done');
    } else {
        console.log('No content found');
    }
};

addClassification();
