import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  url: string = 'http://localhost:5000/webapi/messages';
  msg: string = '';
  fetched_msg:any = '';
  send_msg()
  {
    let data = {
      "author": "Vibha",
      "created": "2021-05-14T07:33:19.084Z[UTC]",
      "id": 3
     };
    Object.assign(data, {message: this.msg});
    console.log(data);
    this.http.post(this.url, data).subscribe(res => {
    alert("Data Sent");
    });
  }

  async get_msg()
  {
    let temp_data: any = await this.http.get(this.url).toPromise().then();
    // this.fetched_msg = temp_data.valueOf();
    // let n = Object.keys(temp_data).length;
    // let temp_data1 = await this.http.get(this.url+"/"+n).toPromise().then();
    // this.fetched_msg = temp_data1;
    console.log(temp_data);
    alert(temp_data.message)
    //console.log(temp_data.message);

  }

  constructor(private http: HttpClient){}
}
