describe('Titanic API K8s Tests', () => {
  it('Gateway Health Check returns ok', () => {
    // Делаем запрос к нашему Gateway, который прокинут на порт 8000
    cy.request('http://gateway:8000/health').then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});