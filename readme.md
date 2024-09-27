welcome
to run locally on mac:
cd to the folder containing this readme
you can either 1) run gunicorn and run both frontend and backend as one server,
or 2) run a separate frontend server and a separate backend server

1) run "gunicorn app:app" in the root directory.

2) cd frontend, run 'npm run build' and then 'npm start'
in a separate terminal window, run 'flask run' in the directory containing this readme.