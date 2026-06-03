import qqMusic from 'qq-music-api';

async function test() {
  const uid = '2123613811';
  try {
    const res = await qqMusic.api('user/detail', { id: uid });
    console.log(Object.keys(res));
    if (res.creator) {
      console.log('Has res.creator');
    } else if (res.data?.creator) {
      console.log('Has res.data.creator');
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
