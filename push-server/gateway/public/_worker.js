export default {
  async fetch(request, env) {
    return env.PUSH.fetch(request);
  },
};
