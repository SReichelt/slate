import { runClientTest } from '../../__mocks__/testClient';

test('run tutorial', () => runClientTest((callback) => ({
  tutorialTest: callback
})), 200000);
