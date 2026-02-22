// ============================================================================
// 1. TEST DATA (Fixtures)
// Abstracting hardcoded values to make tests maintainable and data-driven
// ============================================================================
const TEST_DATA = {
  users: {
    // Generate unique suffix to avoid state leakage locally
    admin: { username: `admin_${Date.now()}`, password: 'Password123!', email: 'admin@titanic.com' },
    regular: { username: `user_${Date.now()}`, password: 'Password123!', email: 'user@titanic.com' }
  },
  passengers: {
    rose: {
      name: "DeWitt Bukater, Miss. Rose DeWitt", pclass: 1, sex: "female",
      age: 17, fare: 71.2833, embarked: "Cherbourg", destination: "New York",
      cabin: "B52", ticket: "PC 17558"
    },
    jack: {
      name: "Dawson, Mr. Jack", pclass: 3, sex: "male",
      age: 20, fare: 0.0, embarked: "Southampton", destination: "Adventure and Freedom",
      cabin: "B52", ticket: "A/5 21171"
    }
  }
};

// ============================================================================
// 2. API CLIENT (Page Object Model equivalent for APIs)
// DRY Principle: Centralizing cy.request calls
// ============================================================================
class TitanicApiClient {
  
// Base request handler
  static sendRequest(method: string, endpoint: string, body: any = null, token: string = '', failOnStatusCode = true) {
    const options = { 
      method, 
      url: endpoint, 
      failOnStatusCode 
    } as Cypress.RequestOptions; 

    if (body) options.body = body;
    if (token) options.headers = { Authorization: `Bearer ${token}` };
    
    return cy.request(options);
  }

  // Domain-specific endpoints
  static checkHealth() {
    return this.sendRequest('GET', '/health');
  }

  static register(userObj: any) {
    return this.sendRequest('POST', '/api/auth/register', userObj);
  }

  static login(userObj: any) {
    return this.sendRequest('POST', '/api/auth/login', { username: userObj.username, password: userObj.password });
  }

  static createPassenger(passengerData: any, token: string, failOnStatusCode = true) {
    return this.sendRequest('POST', '/api/passengers', passengerData, token, failOnStatusCode);
  }

  static deletePassenger(id: number, token: string, failOnStatusCode = true) {
    return this.sendRequest('DELETE', `/api/passengers/${id}`, null, token, failOnStatusCode);
  }
}

// ============================================================================
// 3. TEST SUITE
// ============================================================================
describe('Titanic Microservices API Tests', () => {
  
  let adminToken = '';
  let regularToken = '';
  // Array to track created entities for dynamic cleanup
  let passengersToCleanup: number[] = []; 

  // SETUP: Runs ONCE before all tests. Registers global users.
  before(() => {
    // 1. Create global Admin
    TitanicApiClient.register(TEST_DATA.users.admin).then((res) => {
      expect(res.status).to.eq(201);
    });
    TitanicApiClient.login(TEST_DATA.users.admin).then((res) => {
      adminToken = res.body.access_token;
    });

    // 2. Create global Regular User
    TitanicApiClient.register(TEST_DATA.users.regular);
    TitanicApiClient.login(TEST_DATA.users.regular).then((res) => {
      regularToken = res.body.access_token;
    });
  });

  // TEARDOWN: Runs AFTER EACH test. Ensures isolated state.
  afterEach(() => {
    if (passengersToCleanup.length > 0) {
      cy.log(`CLEANUP: Deleting ${passengersToCleanup.length} passenger(s) to restore DB state`);
      
      passengersToCleanup.forEach(id => {
        TitanicApiClient.deletePassenger(id, adminToken, false).then(res => {
          if (res.status === 403) cy.log(`WARNING: Failed to delete ID ${id}. Check admin rights.`);
        });
      });
      // Clear the array for the next test
      passengersToCleanup = []; 
    }
  });


  // --- ACTUAL TESTS ---

  it('1. [Gateway] Health Check returns OK', () => {
    TitanicApiClient.checkHealth().then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('gateway');
    });
  });

  it('2. [Auth] Ensure Global Admin has access token', () => {
    // Since login happens in before(), we just assert the state here
    expect(adminToken).to.not.be.empty;
    expect(regularToken).to.not.be.empty;
  });

  it('3. [Passenger] RBAC: Regular user cannot delete a passenger (403)', () => {
    // Create a dummy passenger using Admin to ensure DB has at least one passenger
    TitanicApiClient.createPassenger(TEST_DATA.passengers.rose, adminToken).then((createRes) => {
      const targetId = createRes.body.id;
      passengersToCleanup.push(targetId); // Mark for cleanup
      
      // Attempt to delete it using REGULAR user token
      TitanicApiClient.deletePassenger(targetId, regularToken, false).then((delResponse) => {
        expect(delResponse.status).to.eq(403);
        expect(delResponse.body.detail).to.include('Admin access required');
      });
    });
  });

  it('4. [Passenger] Easter Egg: Jack and Rose cannot share a cabin', () => {
    // Put Rose in cabin
    TitanicApiClient.createPassenger(TEST_DATA.passengers.rose, adminToken).then((roseRes) => {
      expect(roseRes.status).to.eq(201);
      passengersToCleanup.push(roseRes.body.id); // Mark for cleanup
    });

    // Try to put Jack in the SAME cabin
    TitanicApiClient.createPassenger(TEST_DATA.passengers.jack, adminToken, false).then((jackRes) => {
      // If Jack somehow got created (test fails), ensure we clean him up too!
      if (jackRes.status === 201) passengersToCleanup.push(jackRes.body.id);
      
      // Assert Easter Egg
      expect(jackRes.status).to.eq(401);
      expect(jackRes.body.detail).to.include('Different social classes cannot share cabins on Titanic');
    });
  });

});