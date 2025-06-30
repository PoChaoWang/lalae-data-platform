# LaLaE Data Platform

[Web Link](https://v0-data-platform-test.vercel.app/)

LaLaE is a data platform designed for marketers to seamlessly connect their **Google Ads**, **Facebook Ads**, and **Google Sheets** data. It enables users to **clean, transform, and export data via SQL**, significantly reducing the time spent on manual data preparation.

The platform is built on **Google Cloud Platform (GCP)** and leverages **BigQuery** for data storage and processing. Below is an overview of its key features.

## Dashboard

The landing page after login provides an at-a-glance view of the entire data pipeline, including:

- Current counts of **Clients**, **Connections**, and **Queries**
- Latest error messages

This allows users to monitor the system in real time and quickly identify and fix issues.

## Clients

To use LaLaE, users must first create a **Client**.

Once created, LaLaE provisions a dedicated **BigQuery dataset** for that user and Client. All **Connections** and **Queries** created under this Client are scoped to this dataset.

Authorization records for ad accounts are also managed through the Client. Future updates will include **dataset sharing** for better team collaboration.

## Connections

LaLaE provides API connections to advertising and data sources. Currently supported:

- Google Ads
- Facebook Ads
- Google Sheets

> Additional ad platforms will be added in the future.

The **Connections** page displays all existing connections, their associated **datasets**, and the most recent sync logs.

### Google Ads

- Requires user authorization to access Google Ads data.
- LaLaE stores the **active token** and **refresh token** securely, refreshing tokens automatically when needed.
- After authorization, users input their Google Ads account ID and select the **Report Level** with desired **metrics**, **segments**, and **attributes**.
- Users can configure how often to pull data from Google Ads to update the **BigQuery** dataset.

> _Note: Currently, LaLaE's developer token is approved only for test accounts and cannot fetch production data._

### Facebook Ads

- Users authorize LaLaE to access their Facebook Ads data.
- After authorization, LaLaE fetches the user's available ad accounts.
- Users select the desired account via dropdown, specify the **Insights Level**, and choose **Fields**, **Breakdowns**, and **Action Breakdowns**.
- Users can configure the sync frequency to update their **BigQuery** dataset with Facebook Ads data.

### Google Sheets

- Users must add the specified LaLaE service email to their Google Sheet and grant **Editor** or higher permissions.
- The **General Access** setting must be configured as **Anyone with the link** to allow LaLaE to read data.
- Users specify column headers (comma-separated) and corresponding data types. BigQuery uses these settings to create the dataset schema.
- Sync frequency can be scheduled to keep the dataset up to date in BigQuery.

## Queries

Once a **Connection** successfully syncs data to BigQuery, users can:

- Run SQL **queries** to clean, transform, and merge data.
- Define output frequency to automate exports.

Currently, exports are supported only to **Google Sheets**. To set this up:

- Add the LaLaE service email to the target Google Sheet with **Editor** access.
- Set **General Access** to **Anyone with the link**.
- Specify the Google Sheet ID and the **tab name**.
- Choose whether to **append** new data or overwrite.
