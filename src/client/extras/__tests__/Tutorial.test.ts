import { runClientTest } from '../../__mocks__/testClient';

test('run tutorial', () => runClientTest(() => {
  // TODO
  return new Promise((resolve) => setTimeout(resolve, 1000));
}));
