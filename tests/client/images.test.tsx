// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ImageFrame } from '../../client/components/ui/ImageFrame';
import { translate } from '../../client/i18n';
import { COMMONS_WIDTHS, commonsSources } from '../../client/lib/images';
import { pinLanguage } from './language';

pinLanguage('en');
afterEach(cleanup);

const BASE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Lion%28x%29.jpg/';
const THUMB = `${BASE}960px-Lion%28x%29.jpg`;
const ORIGINAL = 'https://upload.wikimedia.org/wikipedia/commons/7/73/Lion.jpg';

describe('commonsSources', () => {
  it('offers only standard Commons widths up to the stored thumbnail', () => {
    expect(commonsSources(THUMB)).toEqual({
      src: THUMB,
      srcSet: `${BASE}330px-Lion%28x%29.jpg 330w, ${BASE}500px-Lion%28x%29.jpg 500w, ${THUMB} 960w`,
    });
    expect(COMMONS_WIDTHS).toEqual([330, 500, 960, 1280]);
  });

  it('leaves originals, small thumbnails and other hosts alone', () => {
    expect(commonsSources(ORIGINAL).srcSet).toBeNull();
    expect(commonsSources(`${BASE}330px-Lion%28x%29.jpg`).srcSet).toBeNull();
    expect(commonsSources('/local/image.png').srcSet).toBeNull();
  });
});

describe('ImageFrame', () => {
  it('shows a skeleton until the image loads, then fades it in', () => {
    render(<ImageFrame image={{ url: THUMB, alt: 'A big cat' }} language="en" />);
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
    render(<ImageFrame image={{ url: THUMB, alt: 'A big cat' }} />);
    fireEvent.error(screen.getByAltText('A big cat'));
    const plain = screen.getByAltText('A big cat');
    expect(plain.getAttribute('srcset')).toBeNull();
    fireEvent.error(plain);
    expect(screen.getByRole('img', { name: translate('image.unavailable') })).toBeTruthy();
  });

  it('starts again for a new image and handles a missing one', () => {
    const { rerender } = render(<ImageFrame image={{ url: ORIGINAL, alt: 'One' }} />);
    fireEvent.error(screen.getByAltText('One'));
    expect(screen.getByRole('img', { name: translate('image.unavailable') })).toBeTruthy();
    rerender(<ImageFrame image={{ url: THUMB, alt: 'Two' }} />);
    expect(screen.getByAltText('Two')).toBeTruthy();
    rerender(<ImageFrame image={null} />);
    expect(screen.getByRole('img', { name: translate('image.unavailable') })).toBeTruthy();
  });
});
