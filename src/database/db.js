import mongoose from 'mongoose';
import dotenv from "dotenv";
import EnergyUsage from '../models/energy.model.js';
import Permission from '../models/permission.model.js';
import Role from '../models/role.model.js';
import RolePermission from '../models/rolePermission.model.js';
import { faker } from '@faker-js/faker';
dotenv.config();

/**
 * Connect to MongoDB if not already connected.
 * Typically called once at the start of your application.
 */
export const connectDB = async () => {
    // If Mongoose is already connected (readyState=1) or connecting (readyState=2),
    // we do not attempt to re-connect.
    const { readyState } = mongoose.connection;
    if (readyState === 1 || readyState === 2) {
        console.log("MongoDB is already connected or connecting");
        return;
    }

    try {
        // Use the .env variable MONGO_URI for the connection string
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB connected to host: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Failed to connect MongoDB: ${error.message}`);
        process.exit(1);
    }
};

/**
 * Insert 'count' fake documents into the EnergyUsage collection.
 * This function does NOT close the DB connection afterward,
 * so your app can remain connected for subsequent requests.
 *
 * @param {number} count - how many records to insert (default: 60)
 */
export const insertData = async (count = 365) => {
    try {
        console.log("[DEBUG] Starting insertData function with count:", count);

        // Clear existing data
        await EnergyUsage.deleteMany({});
        console.log("[DEBUG] Existing energy usage data cleared");

        const energyData = [];
        const today = new Date();
        console.log("[DEBUG] Today's date:", today);

        // Generate a document for each day from 364 days ago to today
        for (let i = 0; i < count; i++) {
            const dayDate = new Date(today);
            dayDate.setDate(today.getDate() - (count - 1 - i));
            const usageValue = faker.number.float({ min: 70, max: 90, precision: 5 });
            energyData.push({
                date: dayDate,
                energyusage: usageValue
            });
        }

        console.log("[DEBUG] Inserting generated data into MongoDB...");
        await EnergyUsage.insertMany(energyData);
        console.log(`[DEBUG] ${count} documents inserted successfully!`);
    } catch (error) {
        console.error(`[ERROR] Error inserting data: ${error.message}`);
        process.exit(1);
    }
};


const permissions = [
    "addDevice",
    "deleteDevice",
    "editDevice",
    "viewReport",
    "addRoom",
    "deleteRoom",
    "adjustTemp",
    "switchOn",
    "switchOff",
    "addUser",
    "deleteUser",
    "changeSettings",
    "updateSystem",
    "backupSystem"
];

const roles = [
    { role_name: "Home Dweller" },  // Basic user
    { role_name: "Home Owner" },    // Home owner with full control
    { role_name: "Developer" }      // Developer for system management
];

const rolePermissionsMapping = {
    "Home Dweller": ["switchOff", "viewReport"],
    "Home Owner": ["switchOn", "switchOff", "adjustTemp", "viewReport", "addDevice", "deleteDevice", "addRoom", "addUser", "editDevice", "changeSettings"],
    "Developer": ["switchOn", "switchOff", "adjustTemp", "viewReport", "addDevice", "deleteDevice", "addRoom", "addUser", "editDevice", "changeSettings", "updateSystem", "backupSystem"]
};

export async function addPermissions() {
    try {
        console.log('[DEBUG] Starting permissions and role-permission mapping insertion...');


        for (const permission of permissions) {
            await Permission.updateOne(
                { name: permission },
                { $setOnInsert: { name: permission } },
                { upsert: true }
            );
        }
        console.log('[DEBUG] Permissions inserted (new ones only).');


        const existingRoles = await Role.find();
        const existingPermissions = await Permission.find();


        const roleMap = Object.fromEntries(existingRoles.map(r => [r.role_name, r._id]));
        const permissionMap = Object.fromEntries(existingPermissions.map(p => [p.name, p._id]));


        for (const [roleName, permissionList] of Object.entries(rolePermissionsMapping)) {
            const roleId = roleMap[roleName];
            if (!roleId) {
                console.warn(`[WARNING] Role '${roleName}' does not exist, skipping.`);
                continue;
            }

            for (const permissionName of permissionList) {
                const permissionId = permissionMap[permissionName];
                if (!permissionId) {
                    console.warn(`[WARNING] Permission '${permissionName}' does not exist, skipping.`);
                    continue;
                }

                await RolePermission.updateOne(
                    { role_id: roleId, permission_id: permissionId },
                    { $setOnInsert: { role_id: roleId, permission_id: permissionId } },
                    { upsert: true }
                );
            }
        }

        console.log("Roles and permissions mapping updated (without modifying roles).");
    } catch (error) {
        console.error("Error updating permissions and role-permission mappings:", error);
    }
}

/**
 * Optional function to close the connection.
 * Call this if you want to end the process or
 * if you're sure you no longer need the DB connection.
 */
export const closeDB = async () => {
    try {
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
    } catch (error) {
        console.error("Error closing MongoDB connection:", error);
    }
};
