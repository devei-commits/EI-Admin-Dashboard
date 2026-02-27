# EI-Admin

1. checkout to latest frontend admin dashboard branch
2. git pull from remote
3. go to the backend repo. checkout to branch you need to work on
4. git pull the branch
5. update the .env file. DATABASE_URL needs to change based on whether you want to ping local or remote postgres instance.
6. docker-compose up --build the backend
7. now you're ready to spin up the frontend in the branch of your choice -> npm run dev
