import dotenv from 'dotenv';

dotenv.config();

const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:4001/api/v1';

/**
 * Validates if an employee ID exists and is active in hris-be-core.
 * Uses service-to-service HTTP call to core's check endpoint.
 * 
 * @param {number|string} empId - The employee ID to check
 * @returns {Promise<boolean>} True if employee exists and is active, false otherwise
 */
export async function verifyEmployeeInCore(empId) {
  if (!empId) return false;

  const url = `${CORE_SERVICE_URL}/employees/check/${empId}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Core Service check failed with status ${response.status} for URL: ${url}`);
      return false;
    }

    const body = await response.json();
    return body.status === 'success' && body.data && body.data.exists === true;
  } catch (error) {
    console.error(`Failed to connect to Core Service at ${url}:`, error.message);
    throw new Error(`Koneksi ke Core Service terputus: ${error.message}`);
  }
}
