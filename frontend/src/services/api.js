import { API, Auth } from 'aws-amplify';

const API_NAME = 'ci-alert-api';

class ApiService {
  async getAuthHeaders() {
    try {
      const session = await Auth.currentSession();
      const token = session.getIdToken().getJwtToken();
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('Error getting auth headers:', error);
      throw error;
    }
  }

  // Watchlist API
  async getWatchlist() {
    try {
      const headers = await this.getAuthHeaders();
      return await API.get(API_NAME, '/v1/watchlist', { headers });
    } catch (error) {
      console.error('Error getting watchlist:', error);
      throw error;
    }
  }

  async addToWatchlist(molecule, aliases = []) {
    try {
      const headers = await this.getAuthHeaders();
      return await API.post(API_NAME, '/v1/watchlist', {
        headers,
        body: { molecule, aliases },
      });
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      throw error;
    }
  }

  async removeFromWatchlist(molecule) {
    try {
      const headers = await this.getAuthHeaders();
      return await API.del(API_NAME, `/v1/watchlist/${encodeURIComponent(molecule)}`, {
        headers,
      });
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      throw error;
    }
  }

  // Insights API
  async getInsights(params = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const queryString = new URLSearchParams(params).toString();
      const path = `/v1/insights${queryString ? `?${queryString}` : ''}`;
      return await API.get(API_NAME, path, { headers });
    } catch (error) {
      console.error('Error getting insights:', error);
      throw error;
    }
  }

  async getMoleculeInsights(molecule, params = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const queryString = new URLSearchParams(params).toString();
      const path = `/v1/insights/${encodeURIComponent(molecule)}${queryString ? `?${queryString}` : ''}`;
      return await API.get(API_NAME, path, { headers });
    } catch (error) {
      console.error('Error getting molecule insights:', error);
      throw error;
    }
  }

  // User Settings API
  async getUserSettings() {
    try {
      const headers = await this.getAuthHeaders();
      return await API.get(API_NAME, '/v1/user-settings', { headers });
    } catch (error) {
      console.error('Error getting user settings:', error);
      throw error;
    }
  }

  async updateUserSettings(settings) {
    try {
      const headers = await this.getAuthHeaders();
      return await API.put(API_NAME, '/v1/user-settings', {
        headers,
        body: settings,
      });
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw error;
    }
  }
}

export default new ApiService();