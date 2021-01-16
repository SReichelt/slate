import { AppTest } from '../../App';
import { runClientTest } from '../../__mocks__/testClient';

test('run tutorial', () => runClientTest((appTest: AppTest) => ({
  tutorialTest: appTest
})), 200000);
