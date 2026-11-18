// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ImageFrame } from '../../client/components/ui/ImageFrame';
import { translate } from '../../client/i18n';
import { imageSources } from '../../client/lib/images';
import { pinLanguage } from './language';

pinLanguage('en');
afterEach(cleanup);

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';
const THUMB = { url: `/img/${TOKEN}`, widths: [330, 500, 960] };
const ORIGINAL = { url: '/img/ZyXwVuTsRqPoNmLkJiHgFe' };

describe('imageSources', () => {
  it('builds the srcset from the widths offered by the proxy', () => {
    expect(imageSources(THUMB)).toEqual({
      src: `/img/${TOKEN}?w=960`,
      srcSet: `/img/${TOKEN}?w=330 330w, /img/${TOKEN}?w=500 500w, /img/${TOKEN}?w=960 960w`,
    });
  });

  it('serves originals, single widths and foreign URLs as they are', () => {
    expect(imageSources(ORIGINAL)).toEqual({ src: ORIGINAL.url, srcSet: null });
    expect(imageSources({ url: THUMB.url, widths: [330] }).srcSet).toBeNull();
    expect(imageSources({ url: '/local/image.png', widths: [330, 500] }).srcSet).toBeNull();
  });
});

describe('ImageFrame', () => {
  it('shows a skeleton until the image loads, then fades it in', () => {
    render(<ImageFrame image={{ ...THUMB, alt: 'A big cat' }} language="en" />);
    const img = screen.getByAltText('A big cat');
    expect(img.getAttribute('srcset')).toContain('500w');
    expect(img.getAttribute('sizes')).toBeTruthy();
    expect(img.getAttribute('lang')).toBe('en');
    expect(screen.getByTestId('image-skeleton')).toBeTruthy();
    fireEvent.load(img);
    expect(screen.queryByTestId('image-skeleton')).toBeNull();
    expect(img.className).toContain('opacity-100');
  });

  it('retries without srcset, then shows an accessible placeholder', () => {
    render(<ImageFrame image={{ ...THUMB, alt: 'A big cat' }} />);
    fireEvent.error(screen.getByAltText('A big cat'));
    const plain = screen.getByAltText('A big cat');
    expect(plain.getAttribute('srcset')).toBeNull();
    expect(plain.getAttribute('src')).toBe(`/img/${TOKEN}?w=960`);
    fireEvent.error(plain);
    expect(screen.getByRole('img', { name: translate('image.unavailable') })).toBeTruthy();
  });

  it('starts again for a new image and handles a missing one', () => {
    const { rerender } = render(<ImageFrame image={{ ...ORIGINAL, alt: 'One' }} />);
    fireEvent.error(screen.getByAltText('One'));
    expect(screen.getByRole('img', { name: translate('image.unavailable') })).toBeTruthy();
    rerender(<ImageFrame image={{ ...THUMB, alt: 'Two' }} />);
    expect(screen.getByAltText('Two')).toBeTruthy();
    rerender(<ImageFrame image={null} />);
    expect(screen.getByRole('img', { name: translate('image.unavailable') })).toBeTruthy();
  });
});
